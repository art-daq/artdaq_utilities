
function errmsg() {
    local msg=$1
    echo $msg >&2
    exit 1
}


# Since we'll be creating temporary directories, checking out
# packages, etc., we don't want to be in the directory structure of
# the artdaq-utilities package itself

function safety_check() {

    res=$( echo $PWD | sed -r -n '/\/artdaq-utilities/p' )

    if [[ -n "$res" ]]; then
	echo "Directory you're in (${PWD}) appears to be part of the artdaq-utilities package itself; please execute this script outside of the package so as not to confuse git" >&2
	exit 1
    fi
}
