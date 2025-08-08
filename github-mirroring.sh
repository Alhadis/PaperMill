#!/bin/sh
set -e

#
# Generate an exhaustive listing of a GitHub user's repositories.
# Output is written to "$1.json" in the current working directory.
#
# Paginated results are written to the following ephemeral files:
#    $1.#.json      -- JSON data returned from API query
#    $1.#.json.http -- HTTP response headers of the above
# These files are removed once the full dataset has been downloaded.
#
# Parameters;
#    $1 [username] (Default: `$GITHUB_USER`)
#       Name of GitHub user from which to enumerate works by.
#       An organisation may be specified instead by prefixing the name with "@";
#       similarly, the prefix "gist:" will query Gists instead of repositories.
#
#    $2 [page-number=1]
#       Page number to request from a set of paginated results.
#
# Environment:
#    GITHUB_USER
#       Username of currently-logged in user. This influences whether
#       private repositories (or gists) will be included in the dataset.
#
#    GITHUB_TOKEN
#       Personal access token granting full `gist` and `repo` privileges.
#       This is used to authenticate $GITHUB_USER against $1, as well as
#       increasing the hourly rate-limit.
#
list_github_repos(){
	set -- "$1" "${2:-1}"
	case $1 in
		gist:*) set -- "${1#*:}" "$2" gists;;
		'')     set -- "$GITHUB_USER" "$2" users;;
		@*)     set -- "$@" orgs;;
		*)      set -- "$@" users;;
	esac
	set -- "${1#@}" "$2" "${1#@}${2:+.$2}.json" "$3/${1#@}/repos?"
	if printf %s "$1" | grep . | grep -ixqF "$GITHUB_USER"; then
		[ -n "$GITHUB_TOKEN" ] || echo >&2 "Warning: No token specified; listing public repos only"
		case $4 in
			gists/*) set -- "$1" "$2" "$3" 'gists?';;
			*)       set -- "$1" "$2" "$3" 'user/repos?affiliation=owner&';;
		esac
	elif [ "${4%%/*}" = gists ]; then
		set -- "$1" "$2" "$3" "users/$1/gists?"
	fi
	curl -L -D "$3.http" \
		-H 'Accept: application/vnd.github+json' \
		-H 'X-GitHub-Api-Version: 2022-11-28' \
		${GITHUB_TOKEN:+-H "Authorization: Bearer $GITHUB_TOKEN"} \
		"https://api.github.com/${4}per_page=100${2:+&page=$2}" \
	| jq --tab . > "$3"
	set -- "$1" "$2" "`\
		grep -im1 '^link:' "$3.http" |\
		sed -n 's/.*<\([^<>]*\)>; *rel="next".*/\1/p'`"
	if [ -n "$3" ]; then
		case "$3&" in *"&page=$(($2+1))&");; *)
			echo >&2 "Pagination URL contains unexpected 'page' parameter:"
			printf '\033[4m%s\033[24m\n' "$3"
			return 1
		;; esac
		list_github_repos "$1" "$(($2+1))"
	elif [ "$2" -eq 1 ]; then
		mv -f "$1.1.json" "$1.json"
		rm -f "$1.1.json.http"
	else
		set -- "$1" "$2" 1
		while [ "$3" -le "$2" ]; do
			[ -f "$1.$3.json" ] || {
				printf >&2 'Page %s missing from paginated JSON\n' "$3"
				return 1
			}
			eval "shift 3 && set -- \"$1\" \"$2\" \"$(($3+1))\" \"\$@\" \"$1.$3.json\""
		done
		shift 3
		jq --tab -s '[.] | flatten(2)' "$@" > "${1%.1.json}.json"
		while [ $# -gt 0 ]; do
			rm -f "$1" "$1.http"
			shift
		done
	fi
}

[ -f .env ] && eval "`${0%/*}/read-dotenv.mjs .env`"
[ "${GITHUB_USER+1}" ] || GITHUB_USER=`git config github.user || git config user.name`
list_github_repos "$@"
