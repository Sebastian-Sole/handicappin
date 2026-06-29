#!/bin/bash
# PostToolUse hook: nudge review when a course seed SQL file is hand-written/edited.
# Course data drives handicap math, so unvalidated edits get an advisory.
# Non-blocking (always exit 0). Note: the course:ingest CLI writes files directly
# (not via the Write tool), so this fires on manual edits/promotions — exactly the
# cases that skip the pipeline's own validation.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

[ -z "$FILE_PATH" ] && exit 0

# Only course seed SQL (including the _staging review area).
case "$FILE_PATH" in
  */scripts/sql/*.sql) ;;
  *) exit 0 ;;
esac

[ -f "$FILE_PATH" ] || exit 0

HOLES=$(grep -c 'insert into public.hole' "$FILE_PATH" 2>/dev/null || true)
TEES=$(grep -c 'returning id into v_tee_id' "$FILE_PATH" 2>/dev/null || true)
HOLES=${HOLES:-0}
TEES=${TEES:-0}

echo ""
echo "--- COURSE DATA: $(basename "$FILE_PATH") changed ---"

# Structural sanity: holes should be 18 per tee.
if [ "$TEES" -gt 0 ] && [ $((HOLES % 18)) -ne 0 ]; then
  echo "⚠ $HOLES hole inserts across $TEES tee(s) — expected a multiple of 18 (18 per tee). Verify the grid."
fi

case "$FILE_PATH" in
  */_staging/*)
    echo "This is STAGED (pending) data — excluded from build-seed.sh until moved into scripts/sql/."
    ;;
  *)
    echo "This sits in the SEED path (scripts/sql/) — it ships in the next build-seed run."
    ;;
esac

echo "Before promoting: confirm the distance unit (yards vs meters), check front/back-9 aren't fabricated, and run the course-data-validator agent against the source."
echo "---"

exit 0
