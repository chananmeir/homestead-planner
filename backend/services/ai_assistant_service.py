"""
Garden Assistant Service

Builds a compact, read-only snapshot of the user's current garden state and
streams responses from any OpenAI-compatible chat completions endpoint.

Configuration is read from environment variables so secrets never live in
source:

    LLM_BASE_URL  - OpenAI-compatible base URL (default: OpenAI public API)
    LLM_API_KEY   - API key for the endpoint (required to enable the assistant)
    LLM_MODEL     - Model name (default: gpt-4o-mini)
    LLM_TIMEOUT   - Per-request timeout in seconds (default: 60)

The service is intentionally stateless: conversation history is owned by the
client and echoed back on each request. Only the system prompt + garden context
are assembled server-side.
"""

import logging
import os
from datetime import datetime

from sqlalchemy import or_

from models import db, GardenBed, GardenPlan, PlantedItem
from plant_database import get_plant_by_id
from simulation_clock import get_now

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://api.openai.com/v1"
DEFAULT_MODEL = "gpt-4o-mini"
DEFAULT_TIMEOUT = 60
MAX_HISTORY_MESSAGES = 20  # Cap so token cost stays predictable


def get_assistant_config():
    """Return the LLM configuration from environment variables.

    Returns a dict with `configured` flag so callers can gracefully hide the
    feature when no API key is present.
    """
    api_key = os.environ.get("LLM_API_KEY", "").strip()
    # Treat the template placeholder as "not set" so the sidebar shows the
    # "not configured" banner until a real key is supplied.
    if api_key in ("", "YOUR_API_KEY_HERE"):
        api_key = ""
    base_url = os.environ.get("LLM_BASE_URL", "").strip()
    if base_url in ("", "YOUR_BASE_URL_HERE"):
        base_url = DEFAULT_BASE_URL
    model = os.environ.get("LLM_MODEL", "").strip()
    if model in ("", "YOUR_MODEL_NAME_HERE"):
        model = DEFAULT_MODEL
    try:
        timeout = int(os.environ.get("LLM_TIMEOUT", str(DEFAULT_TIMEOUT)))
    except ValueError:
        timeout = DEFAULT_TIMEOUT

    return {
        "configured": bool(api_key),
        "base_url": base_url,
        "api_key": api_key,
        "model": model,
        "timeout": timeout,
    }


SYSTEM_PROMPT_TEMPLATE = """You are the Homestead Garden Assistant, a knowledgeable gardening coach embedded inside a homestead-planning app.

You are talking to a home gardener who is currently looking at their Garden Designer. Your job is to give practical, specific, region-agnostic advice based on the crops and beds they actually have.

Style rules:
- Be concise. Prefer short paragraphs or bullet points over essays.
- Use the garden context below to ground your answers; reference specific beds, varieties, and dates when relevant.
- When you don't have enough information (e.g. their growing zone, pest pressure, soil test results), say so and ask.
- Do not invent specific quantities of fertilizer, spray, or medicine without caveats; offer ranges and remind them to follow product labels.
- If asked to take an action (add a plant, mark harvested, etc.), explain the steps the user can take in the UI instead of pretending to do it.
- It is OK to discuss companion planting, rotation, timing, spacing, common pests, and seasonal tasks.

GARDEN CONTEXT:
{context}
"""


def build_garden_context(user_id, plan_id=None, date_str=None):
    """Build a compact, plain-text snapshot of the user's garden.

    Args:
        user_id: Current user id (for scoping queries).
        plan_id: Optional active plan id to summarize.
        date_str: Optional ISO date string; defaults to the simulation clock's today.

    Returns:
        A plain-text string suitable for embedding in the system prompt.
    """
    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            target_date = get_now().date()
    else:
        target_date = get_now().date()

    lines = [f"As-of date: {target_date.isoformat()}"]

    # Active plan summary
    plan = None
    if plan_id:
        plan = GardenPlan.query.filter_by(id=plan_id, user_id=user_id).first()
    if plan is None:
        plan = (
            GardenPlan.query.filter_by(user_id=user_id)
            .order_by(GardenPlan.year.desc(), GardenPlan.id.desc())
            .first()
        )

    if plan:
        plan_line = f"Active plan: \"{plan.name}\""
        if getattr(plan, "year", None):
            plan_line += f" ({plan.year})"
        if getattr(plan, "strategy", None):
            plan_line += f", strategy: {plan.strategy}"
        lines.append(plan_line)
    else:
        lines.append("Active plan: none")

    # Beds + active plantings on the target date
    beds = (
        GardenBed.query.filter_by(user_id=user_id)
        .order_by(GardenBed.id)
        .all()
    )

    if not beds:
        lines.append("Beds: none created yet.")
        return "\n".join(lines)

    lines.append(f"Beds: {len(beds)} total")
    for bed in beds:
        lines.append(_format_bed(bed, target_date))

    return "\n".join(lines)


def _format_bed(bed, target_date):
    """Render a single bed and its active plantings as a compact text block."""
    header = (
        f"- Bed \"{bed.name}\" "
        f"({bed.width:g}x{bed.length:g} ft"
        f", sun: {bed.sun_exposure or 'unknown'}"
        f", method: {bed.planning_method or 'unknown'}"
        f")"
    )

    # Active = planted on/before target_date and not yet harvested/cancelled.
    items = (
        PlantedItem.query.filter(
            PlantedItem.garden_bed_id == bed.id,
            PlantedItem.user_id == bed.user_id,
            PlantedItem.cancelled_at.is_(None),
            PlantedItem.cleared_at.is_(None),
            PlantedItem.outcome.is_(None),
            or_(
                PlantedItem.planted_date.is_(None),
                PlantedItem.planted_date <= datetime.combine(target_date, datetime.max.time()),
            ),
        ).all()
    )

    if not items:
        return header + "\n  active plants: (none currently growing)"

    rows = ["  active plants:"]
    for item in items[:40]:  # safety cap
        plant_data = get_plant_by_id(item.plant_id) or {}
        name = plant_data.get("name") or item.plant_id
        variety = f" '{item.variety}'" if item.variety else ""
        dtm = plant_data.get("daysToMaturity")
        planted = item.planted_date.date().isoformat() if item.planted_date else "?"
        pos = f"({item.position_x},{item.position_y})" if item.position_x or item.position_y else ""
        bits = [f"qty {item.quantity}", f"status: {item.status}", f"planted {planted}"]
        if dtm:
            bits.append(f"~{dtm} DTM")
        if pos:
            bits.append(pos)
        if item.notes:
            notes = item.notes.strip().replace("\n", " ")
            if len(notes) > 80:
                notes = notes[:77] + "..."
            bits.append(f"notes: {notes}")
        rows.append(f"  - {name}{variety} - " + ", ".join(bits))
    return header + "\n" + "\n".join(rows)


def build_chat_messages(user_message, history, context_text):
    """Assemble the full message list for the chat completion API.

    Args:
        user_message: The latest user turn.
        history: List of {"role": "user"|"assistant", "content": "..."} dicts.
        context_text: Output of build_garden_context().
    """
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(context=context_text)
    messages = [{"role": "system", "content": system_prompt}]

    # Trim to the most recent turns to keep token usage bounded.
    trimmed = list(history or [])[-MAX_HISTORY_MESSAGES:]
    for turn in trimmed:
        role = turn.get("role")
        content = turn.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": user_message})
    return messages


def stream_chat_completion(messages, config):
    """Yield token deltas from an OpenAI-compatible streaming chat completion.

    Lazily imports the openai SDK so the rest of the app still runs if the
    package is not installed (the blueprint reports `configured=False`).

    Args:
        messages: Full message list (system + history + user).
        config: Dict from get_assistant_config().

    Yields:
        str tokens.
    """
    from openai import OpenAI

    client = OpenAI(
        base_url=config["base_url"],
        api_key=config["api_key"],
        timeout=config["timeout"],
    )

    stream = client.chat.completions.create(
        model=config["model"],
        messages=messages,
        stream=True,
        temperature=0.4,
    )

    for chunk in stream:
        if not getattr(chunk, "choices", None):
            continue
        delta = chunk.choices[0].delta
        token = getattr(delta, "content", None)
        if token:
            yield token
