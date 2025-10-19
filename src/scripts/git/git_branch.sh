codebase_path=$1
branch_name=$2

cd "$codebase_path"
git config user.name "Alex Younger Agent"
git config user.email "thealexyounger@proton.me"
git config commit.gpgsign false
main_trunk=git symbolic-ref HEAD | sed 's/refs\/heads\///'
git checkout -b "$branch_name" $main_trunk
