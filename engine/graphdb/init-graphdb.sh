#!/usr/bin/env sh
set -e

# Hostname of the GraphDB service in the Docker network
GDB_HOST="graphdb"
GDB_PORT="7200"
GDB_URL="http://${GDB_HOST}:${GDB_PORT}"

# Repository ID - MUST match rep:repositoryID in repository.ttl
REPO_ID="ontowebpt"

REPO_CONFIG="/graphdb/repository.ttl"
ONTOLOGY_FILE="/graphdb/ontology.rdf"

echo ">>> Waiting for GraphDB (checking ${GDB_URL}/rest/repositories)..."

# Wait until GraphDB responds on /rest/repositories with HTTP 200
while :; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${GDB_URL}/rest/repositories" || echo "000")
  echo "Current HTTP code from ${GDB_URL}/rest/repositories: ${HTTP_CODE}"

  if [ "${HTTP_CODE}" = "200" ]; then
    break
  fi

  echo "GraphDB not ready yet, retrying in 3s..."
  sleep 3
done

echo ">>> GraphDB is up."

echo ">>> Checking if repository '${REPO_ID}' exists in /rest/repositories ..."

# Get repository list and check if REPO_ID is present
REPO_LIST=$(curl -s "${GDB_URL}/rest/repositories" || echo "")
echo "Current repositories response:"
echo "${REPO_LIST}"

if echo "${REPO_LIST}" | grep -q "\"id\" *: *\"${REPO_ID}\""; then
  echo ">>> Repository '${REPO_ID}' already exists."
else
  echo ">>> Repository '${REPO_ID}' does not exist. Creating..."

  curl -v -X POST "${GDB_URL}/rest/repositories" \
    -H "Accept: application/json" \
    -H "Content-Type: multipart/form-data" \
    -F "config=@${REPO_CONFIG}"

  echo ">>> Repository created."
fi

echo ">>> Checking if ontology is already present in repository '${REPO_ID}'..."

# ASK query: is there any owl:Ontology defined?
ASK_RESPONSE=$(curl -s -G "${GDB_URL}/repositories/${REPO_ID}" \
  --data-urlencode 'query=PREFIX owl: <http://www.w3.org/2002/07/owl#> ASK WHERE { ?s a owl:Ontology . }' \
  -H "Accept: application/sparql-results+json" || echo "")

echo "ASK response:"
echo "${ASK_RESPONSE}"

if echo "${ASK_RESPONSE}" | grep -q '"boolean" *: *true'; then
  echo ">>> Ontology is already present. Skipping import."
  exit 0
fi

echo ">>> Ontology not found. Importing from '${ONTOLOGY_FILE}'..."

curl -v -X POST \
  -H "Content-Type: application/rdf+xml" \
  --data-binary "@${ONTOLOGY_FILE}" \
  "${GDB_URL}/repositories/${REPO_ID}/statements"

echo ">>> Ontology import completed."
