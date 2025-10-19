codebase_path=$1
commit_message=$2

cd "$codebase_path"
git config user.name "Alex Younger Agent"
git config user.email "thealexyounger@proton.me"
git config commit.gpgsign false
git add .
git commit -m "$commit_message" --no-gpg-sign
