branch_name=$1
git config user.name "Alex Younger Agent"
git config user.email "thealexyounger@proton.me"
git config commit.gpgsign false
main_trunk=git symbolic-ref HEAD | sed 's/refs\/heads\///'
git checkout -b "$branch_name" $main_trunk
