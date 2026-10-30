#!/usr/bin/env python3
"""Regenerates the "Project Structure" tree in .github/README.md.

Directories come from the git file list, so new ones show up without a
comment. Comments, expanded directories and listed files are carried over
from the current tree; a directory is expanded only if it has children there.
"""
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
README = ROOT / ".github" / "README.md"
HEADING = "## Project Structure"
FENCE = "```"
COMMENT_COLUMN = 34
INDENT_UNITS = ("│   ", "    ")
BRANCH = re.compile(r"^(├|└)── ")
COMMENT = re.compile(r" +# ")


def parse_tree(lines):
    comments, listed_files, expanded = {}, set(), {""}
    stack = []
    for line in lines:
        depth = 0
        while line.startswith(INDENT_UNITS):
            line = line[4:]
            depth += 1
        line = BRANCH.sub("", line)

        comment = ""
        if match := COMMENT.search(line):
            comment = line[match.end() :]
            line = line[: match.start()]

        parent = stack[depth - 1] if depth else ""
        path = parent + line
        del stack[depth:]
        stack.append(path)

        comments[path] = comment
        if not line.endswith("/"):
            listed_files.add(path)
        if parent:
            expanded.add(parent)
    return comments, listed_files, expanded


def tracked_paths():
    output = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return [path for path in output.splitlines() if not any(part.startswith(".") for part in path.split("/")[:-1])]


def children_by_dir(paths, listed_files):
    children = {}
    for path in paths:
        parts = path.split("/")
        for depth in range(len(parts) - 1):
            parent = "/".join(parts[:depth]) + "/" if depth else ""
            children.setdefault(parent, set()).add("/".join(parts[: depth + 1]) + "/")
        if path in listed_files:
            parent = "/".join(parts[:-1]) + "/" if len(parts) > 1 else ""
            children.setdefault(parent, set()).add(path)
    return children


def render(directory, prefix, children, comments, expanded):
    entries = sorted(
        children.get(directory, ()),
        key=lambda entry: (not entry.endswith("/"), entry.rstrip("/")),
    )
    for index, entry in enumerate(entries):
        is_last = index == len(entries) - 1
        line = prefix + ("└── " if is_last else "├── ") + entry[len(directory) :]
        if comment := comments.get(entry):
            padding = max(COMMENT_COLUMN - len(line), 1)
            line += " " * padding + "# " + comment
        yield line
        if entry in expanded:
            yield from render(entry, prefix + ("    " if is_last else "│   "), children, comments, expanded)


def main():
    lines = README.read_text().split("\n")
    start = lines.index(HEADING)
    open_fence = lines.index(FENCE, start)
    close_fence = lines.index(FENCE, open_fence + 1)
    root_name, *current_tree = lines[open_fence + 1 : close_fence]

    comments, listed_files, expanded = parse_tree(current_tree)
    children = children_by_dir(tracked_paths(), listed_files)
    tree = [root_name, *render("", "", children, comments, expanded)]

    lines[open_fence + 1 : close_fence] = tree
    README.write_text("\n".join(lines))


if __name__ == "__main__":
    main()
