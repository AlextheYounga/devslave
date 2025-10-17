branch_name=$1
main_trunk=git symbolic-ref HEAD | sed 's/refs\/heads\///'
git checkout -b "$branch_name" $main_trunk
