codebase_path=$1
branch_name=$2

cd "$codebase_path"
git config user.name $GIT_USERNAME
git config user.email $GIT_EMAIL
git config commit.gpgsign false
main_trunk=git symbolic-ref HEAD | sed 's/refs\/heads\///'
git checkout -b "$branch_name" $main_trunk
