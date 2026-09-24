"""Convert one local file to Markdown with Microsoft MarkItDown. Prints the text."""
import os
import sys

root = os.path.join(os.getcwd(), ".python-packages")
if os.path.isdir(root) and root not in sys.path:
    sys.path.insert(0, root)

try:
    from markitdown import MarkItDown
except ImportError:
    sys.stderr.write("MarkItDown is not installed.\n")
    sys.exit(2)

path = sys.argv[1]
result = MarkItDown().convert(path)
sys.stdout.buffer.write((result.markdown or "").encode("utf-8"))
