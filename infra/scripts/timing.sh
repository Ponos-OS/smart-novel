# Sourced by start-dev.sh and stop-dev.sh. `timed <label> <command...>` runs the command and records how long it took; the table is printed when the script exits, and appended to the job summary on GitHub Actions.
timings_file="$(mktemp)"

timed() {
  label="$1"
  shift
  started_at="$(date +%s)"
  "$@" && status=0 || status=$?
  printf '%s\t%s\n' "$(($(date +%s) - started_at))" "$label" >> "$timings_file"
  return "$status"
}

print_timings() {
  [ -s "$timings_file" ] || return 0
  echo
  echo "Timings (seconds):"
  awk -F '\t' '{ printf "  %6d  %s\n", $1, $2; total += $1 } END { printf "  %6d  total\n", total }' "$timings_file"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    {
      echo "### ${TIMINGS_TITLE:-Timings}"
      echo
      echo "| Step | Seconds |"
      echo "| --- | ---: |"
      awk -F '\t' '{ printf "| %s | %d |\n", $2, $1 }' "$timings_file"
    } >> "$GITHUB_STEP_SUMMARY"
  fi
  rm -f "$timings_file"
}

trap print_timings EXIT
