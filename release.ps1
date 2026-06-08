# =========================================================
# Auto Build Docker + Git Release Script (Windows)
# =========================================================

$ErrorActionPreference = "Stop"

# =========================
# Config
# =========================

$DOCKER_IMAGE = "helmyyy/finarthax"
$GIT_BRANCH = "main"

# =========================
# Functions
# =========================

function Error-Exit {
    param ([string]$Message)

    Write-Host ""
    Write-Host "$Message" -ForegroundColor Red
    exit 1
}

function Success {
    param ([string]$Message)

    Write-Host "$Message" -ForegroundColor Green
}

function Info {
    param ([string]$Message)

    Write-Host "$Message" -ForegroundColor Cyan
}

# =========================
# Validation
# =========================

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Error-Exit "Docker is not installed."
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Error-Exit "Git is not installed."
}

try {
    docker info | Out-Null
} catch {
    Error-Exit "Docker Desktop is not running."
}

if (-not (Test-Path ".git")) {
    Error-Exit "Current directory is not a git repository."
}

# =========================
# Input
# =========================

Write-Host ""
Write-Host "================================================="
Write-Host "       Auto Docker + Git Release"
Write-Host "================================================="
Write-Host ""

$VERSION = Read-Host "Enter version (example 1.0.0)"

if ($VERSION -notmatch '^\d+\.\d+\.\d+$') {
    Error-Exit "Version format must be like 1.0.0"
}

$COMMIT_MESSAGE = Read-Host "Enter commit message"

if ([string]::IsNullOrWhiteSpace($COMMIT_MESSAGE)) {
    Error-Exit "Commit message cannot be empty."
}

$TAG = "v$VERSION"

# =========================
# Check Existing Tag
# =========================

$existingTag = git tag -l $TAG

if ($existingTag) {
    Error-Exit "Git tag '$TAG' already exists."
}

# =========================
# Docker Build
# =========================

Info "Building Docker image..."

docker build -t "${DOCKER_IMAGE}:${VERSION}" .

Success "Docker image built."

# =========================
# Docker Tag
# =========================

Info "Tagging Docker image..."

docker tag "${DOCKER_IMAGE}:${VERSION}" "${DOCKER_IMAGE}:latest"

Success "Docker image tagged."

# =========================
# Docker Login Check
# =========================

Info "Checking Docker login..."

try {
    docker info | Select-String "Username" | Out-Null
} catch {
    docker login
}

# =========================
# Docker Push
# =========================

Info "Pushing Docker images..."

docker push "${DOCKER_IMAGE}:${VERSION}"
docker push "${DOCKER_IMAGE}:latest"

Success "Docker images pushed."

# =========================
# Git Add
# =========================

Info "Adding git changes..."

git add .

Success "Git add completed."

# =========================
# Git Commit
# =========================

$staged = git diff --cached --name-only

if ([string]::IsNullOrWhiteSpace($staged)) {
    Write-Host "No staged changes to commit." -ForegroundColor Yellow
} else {
    Info "Creating git commit..."

    git commit -m "$COMMIT_MESSAGE"

    Success "Git commit created."
}

# =========================
# Git Tag
# =========================

Info "Creating git tag..."

git tag -a $TAG -m "Release $TAG"

Success "Git tag created."

# =========================
# Git Push
# =========================

Info "Pushing git changes..."

git push origin $GIT_BRANCH
git push origin $TAG

Success "Git pushed successfully."

# =========================
# Finish
# =========================

Write-Host ""
Write-Host "================================================="
Write-Host "RELEASE SUCCESSFUL" -ForegroundColor Green
Write-Host "================================================="
Write-Host ""

Write-Host "Version : $VERSION"
Write-Host "Tag     : $TAG"
Write-Host "Image   : ${DOCKER_IMAGE}:${VERSION}"
Write-Host ""