import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from postgrest import APIError
from supabase import Client, create_client

load_dotenv()

app = Flask(__name__)

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_PUBLISHABLE_KEY")
if not supabase_url or not supabase_key:
    raise RuntimeError("Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in the environment")

supabase: Client = create_client(supabase_url, supabase_key)


@app.get("/health")
def health():
    """Lightweight process health check; does not depend on database availability."""
    return jsonify({"status": "ok"})


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


def database_error(error):
    return jsonify({"error": "Database request failed", "details": error.message}), 500


@app.route("/")
def index():
    try:
        users = supabase.table("users").select("id,email,role").execute().data
    except APIError as error:
        return database_error(error)
    return jsonify(users)


@app.route("/api/events", methods=["GET", "OPTIONS"])
def list_events():
    if request.method == "OPTIONS":
        return "", 204
    try:
        events = supabase.table("events").select(
            "id,organizer_id,title,capacity,status"
        ).execute().data
    except APIError as error:
        return database_error(error)
    return jsonify(events)


@app.route("/api/events/<event_id>", methods=["GET", "OPTIONS"])
def get_event(event_id):
    if request.method == "OPTIONS":
        return "", 204
    try:
        result = (
            supabase.table("events")
            .select("id,organizer_id,title,capacity,status")
            .eq("id", event_id)
            .maybe_single()
            .execute()
        )
    except APIError as error:
        return database_error(error)
    if result.data is None:
        return jsonify({"error": "Event not found"}), 404
    return jsonify(result.data)


@app.route("/api/registrations", methods=["POST", "OPTIONS"])
def create_registration():
    if request.method == "OPTIONS":
        return "", 204
    body = request.get_json(silent=True)
    if not isinstance(body, dict) or not body.get("user_id") or not body.get("event_id"):
        return jsonify({"error": "JSON body must include user_id and event_id"}), 400

    user_id = body["user_id"]
    event_id = body["event_id"]
    try:
        event_result = (
            supabase.table("events")
            .select("id,capacity")
            .eq("id", event_id)
            .maybe_single()
            .execute()
        )
        if event_result.data is None:
            return jsonify({"error": "Event not found"}), 404

        existing = (
            supabase.table("registrations")
            .select("id")
            .eq("event_id", event_id)
            .eq("user_id", user_id)
            .execute()
            .data
        )
        if existing:
            return jsonify({"error": "User is already registered for this event"}), 409

        registrations = (
            supabase.table("registrations")
            .select("id")
            .eq("event_id", event_id)
            .execute()
            .data
        )
        capacity = event_result.data.get("capacity")
        if capacity is not None and len(registrations) >= capacity:
            return jsonify({"error": "Event is at capacity"}), 409

        created = (
            supabase.table("registrations")
            .insert({"user_id": user_id, "event_id": event_id})
            .execute()
            .data
        )
    except APIError as error:
        # A unique (user_id, event_id) constraint also safely handles concurrent duplicates.
        if getattr(error, "code", None) == "23505":
            return jsonify({"error": "User is already registered for this event"}), 409
        return database_error(error)
    return jsonify(created[0] if created else {"user_id": user_id, "event_id": event_id}), 201


@app.route("/api/me/registrations", methods=["GET", "OPTIONS"])
def list_user_registrations():
    if request.method == "OPTIONS":
        return "", 204
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "Pass user_id as a query parameter"}), 400
    try:
        registrations = (
            supabase.table("registrations")
            .select("id,user_id,event_id,created_at")
            .eq("user_id", user_id)
            .execute()
            .data
        )
        event_ids = list({registration["event_id"] for registration in registrations})
        if not event_ids:
            return jsonify([])
        events = (
            supabase.table("events")
            .select("id,title,capacity,status")
            .in_("id", event_ids)
            .execute()
            .data
        )
        events_by_id = {event["id"]: event for event in events}
    except APIError as error:
        return database_error(error)
    return jsonify([
        {**registration, "event": events_by_id.get(registration["event_id"])}
        for registration in registrations
    ])


@app.route("/api/events/<event_id>/registrations", methods=["GET", "OPTIONS"])
def list_event_registrations(event_id):
    if request.method == "OPTIONS":
        return "", 204
    try:
        event_result = (
            supabase.table("events")
            .select("id,organizer_id")
            .eq("id", event_id)
            .maybe_single()
            .execute()
        )
        if event_result.data is None:
            return jsonify({"error": "Event not found"}), 404

        registrations = (
            supabase.table("registrations")
            .select("id,user_id,event_id,created_at")
            .eq("event_id", event_id)
            .execute()
            .data
        )
        user_ids = list({registration["user_id"] for registration in registrations})
        users = []
        if user_ids:
            users = (
                supabase.table("users")
                .select("id,email")
                .in_("id", user_ids)
                .execute()
                .data
            )
    except APIError as error:
        return database_error(error)

    users_by_id = {user["id"]: user for user in users}
    return jsonify([
        {**registration, "user": users_by_id.get(registration["user_id"])}
        for registration in registrations
    ])


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8000")), debug=False)
