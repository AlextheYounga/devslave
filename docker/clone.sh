#!/bin/bash

site=$1
dest=$2

#shellcheck disable=SC2086
git clone ssh://root@localhost:2222$site $dest
