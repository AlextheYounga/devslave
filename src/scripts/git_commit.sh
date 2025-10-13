commit_message=$1
git add .
git commit -m "$commit_message" --no-gpg-sign
