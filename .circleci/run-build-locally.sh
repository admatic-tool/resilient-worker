#!/usr/bin/env bash

branch_name=$(git symbolic-ref -q HEAD)
branch_name=${branch_name##refs/heads/}
branch_name=${branch_name:-HEAD}

current_commit_hash=$(git rev-parse HEAD)

curl --user ${CIRCLE_TOKEN}: \
    --request POST \
    --form revision=${current_commit_hash} \
    --form config=@config.yml \
    --form notify=false \
        https://circleci.com/api/v1.1/project/admatic-tool/resilient-worker/tree/${branch_name}
