commit_message=$1
git config user.name "Alex Younger Agent"
git config user.email "thealexyounger@proton.me"
git config commit.gpgsign false
git add .
git commit -m "$commit_message" --no-gpg-sign
