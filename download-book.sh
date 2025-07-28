#!/bin/sh
set -e

url="https://developer.apple.com/library/archive/documentation/AppleScript/Conceptual/AppleScriptLangGuide/book.json"
base="${url%/*}"
dir="Docs/${base##*/}"
mkdir -p "$dir" && cd "$dir"
[ -s "book.json" ] || wget "$url"

have(){ command -v "$1" >/dev/null 2>&1; }

unset IS_MAC
unset IS_OPENBSD
case `uname -s | LANG=C tr '[A-Z] [a-z]'` in
	darwin)  IS_MAC=1;     export IS_MAC;;
	openbsd) IS_OPENBSD=1; export IS_OPENBSD;;
esac

# Print SHA-256 checksum for each input, omitting filename
if have sha256 >/dev/null 2>&1;
	then sha256(){ command sha256 -rq -- "$@"; }
	else sha256(){ sha256sum -- "$@" | cut -f1 -d' '; }
fi

case `stat --version 2>/dev/null` in
	*GNU*) mtime(){ stat -c %Y "$1"; };;
	*)     mtime(){ stat -f %m "$1"; };;
esac

if [ "$IS_MAC" ]; then
	have wget   && wget()   { command wget --xattr "$@"; }
	have bsdtar && bsdtar() { command bsdtar --acls --fflags --xattrs --mac-metadata "$@"; }
fi


# Generate list of physical content-files to download
if [ -s download-list.txt ]
	then hash=`sha256 download-list.txt`
	else unset hash
fi
files=`grep -o '"href"\s*:\s*"[^"]*"' book.json \
	| sed 's/^"href":"//; s/#[^"]*"$//;' \
	| sort | uniq`
case `printf '%s\n' "$files" | sha256` in
	"$hash") echo >&2 "Files list already up-to-date";;
	*)       printf '%s\n' "$files" > download-list.txt;;
esac

# Download files
while IFS= read -r line; do
	case "$line" in */*) mkdir -p "${line%/*}";; esac
	wget --no-config -O "$line" "$base/$line"
done < download-list.txt
