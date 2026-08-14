# =========================================================
# Flexible Git Release + Docker Script (Windows PowerShell)
# =========================================================

$ErrorActionPreference = "Stop"

# =========================================================
# Config
# =========================================================

$DEFAULT_DOCKER_IMAGE = "helmyyy/finarthax"
$DEFAULT_GIT_BRANCH = "main"

# =========================================================
# Functions
# =========================================================

function Error-Exit {
    param ([string]$Message)

    Write-Host ""
    Write-Host "ERROR: $Message" -ForegroundColor Red
    Write-Host ""
    exit 1
}

function Success {
    param ([string]$Message)

    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Info {
    param ([string]$Message)

    Write-Host "[i] $Message" -ForegroundColor Cyan
}

function Warning {
    param ([string]$Message)

    Write-Host "[!] $Message" -ForegroundColor Yellow
}

function Ask-YesNo {
    param (
        [string]$Question,
        [bool]$Default = $true
    )

    if ($Default) {
        $suffix = "[Y/n]"
    } else {
        $suffix = "[y/N]"
    }

    while ($true) {
        $answer = Read-Host "$Question $suffix"

        if ([string]::IsNullOrWhiteSpace($answer)) {
            return $Default
        }

        switch ($answer.ToLower()) {
            "y" { return $true }
            "yes" { return $true }
            "n" { return $false }
            "no" { return $false }
            default {
                Write-Host "Please answer Y or N." -ForegroundColor Yellow
            }
        }
    }
}

function Ask-Required {
    param (
        [string]$Question,
        [string]$Default = ""
    )

    while ($true) {

        if ([string]::IsNullOrWhiteSpace($Default)) {
            $value = Read-Host $Question
        } else {
            $value = Read-Host "$Question [$Default]"

            if ([string]::IsNullOrWhiteSpace($value)) {
                $value = $Default
            }
        }

        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return $value.Trim()
        }

        Write-Host "Value cannot be empty." -ForegroundColor Yellow
    }
}

# =========================================================
# Header
# =========================================================

Write-Host ""
Write-Host "=================================================" -ForegroundColor DarkGray
Write-Host "       Flexible Git + Docker Release" -ForegroundColor White
Write-Host "=================================================" -ForegroundColor DarkGray
Write-Host ""

# =========================================================
# Validation
# =========================================================

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Error-Exit "Git is not installed."
}

if (-not (Test-Path ".git")) {
    Error-Exit "Current directory is not a git repository."
}

# =========================================================
# Basic Git Info
# =========================================================

$currentBranch = git branch --show-current

Info "Current branch: $currentBranch"

if ([string]::IsNullOrWhiteSpace($currentBranch)) {
    Error-Exit "Unable to determine current git branch."
}

# =========================================================
# Mode
# =========================================================

Write-Host ""
Write-Host "================ Update Mode ================" -ForegroundColor White
Write-Host ""
Write-Host "Quick update  : just commit and push code / config changes."
Write-Host "Full release  : also bump app version, create a Git tag, and optionally build/push Docker."
Write-Host ""

$IS_RELEASE = Ask-YesNo "Is this a full versioned release (not just a code/config update)?" $false

# =========================================================
# Input
# =========================================================

$VERSION = $null
$TAG = $null
$DOCKER_IMAGE = $null

if ($IS_RELEASE) {

    $VERSION = Ask-Required "Enter version (example 1.0.0)"

    if ($VERSION -notmatch '^\d+\.\d+\.\d+$') {
        Error-Exit "Version format must be like 1.0.0"
    }

    $TAG = "v$VERSION"
}

$COMMIT_MESSAGE = Ask-Required "Enter commit message"

$GIT_BRANCH = Ask-Required "Git branch" $DEFAULT_GIT_BRANCH

if ($IS_RELEASE) {
    $DOCKER_IMAGE = Ask-Required "Docker image" $DEFAULT_DOCKER_IMAGE
}

# =========================================================
# Options
# =========================================================

Write-Host ""
Write-Host "================ Release Options ================" -ForegroundColor White
Write-Host ""

$CREATE_TAG = $false
$BUILD_DOCKER = $false
$PUSH_DOCKER = $false
$PUSH_LATEST = $false

if ($IS_RELEASE) {

    $CREATE_TAG = Ask-YesNo "Create Git tag '$TAG'?" $true

    $BUILD_DOCKER = Ask-YesNo "Build Docker image?" $true

    if ($BUILD_DOCKER) {

        $PUSH_DOCKER = Ask-YesNo "Push Docker image to registry?" $true

        if ($PUSH_DOCKER) {
            $PUSH_LATEST = Ask-YesNo "Also push Docker 'latest' tag?" $true
        }
    }
}

$PUSH_GIT = Ask-YesNo "Push Git changes to origin?" $true

$PUSH_GIT_TAG = $false

if ($CREATE_TAG -and $PUSH_GIT) {
    $PUSH_GIT_TAG = Ask-YesNo "Push Git tag '$TAG' to origin?" $true
}

# =========================================================
# Summary
# =========================================================

Write-Host ""
Write-Host "================ Release Summary =================" -ForegroundColor White
Write-Host ""

if ($IS_RELEASE) {
    Write-Host "Mode          : Full release"
} else {
    Write-Host "Mode          : Quick update"
}

if ($IS_RELEASE) {
    Write-Host "Version       : $VERSION"
}

Write-Host "Commit        : $COMMIT_MESSAGE"
Write-Host "Branch        : $GIT_BRANCH"

if ($IS_RELEASE) {
    Write-Host "Docker Image  : $DOCKER_IMAGE"
    Write-Host "Create Tag    : $CREATE_TAG"
    Write-Host "Build Docker  : $BUILD_DOCKER"
    Write-Host "Push Docker   : $PUSH_DOCKER"
    Write-Host "Push Latest   : $PUSH_LATEST"
}

Write-Host "Push Git      : $PUSH_GIT"
Write-Host "Push Git Tag  : $PUSH_GIT_TAG"

Write-Host ""

$CONFIRM = Ask-YesNo "Continue with this release?" $true

if (-not $CONFIRM) {
    Warning "Release cancelled."
    exit 0
}

# =========================================================
# Check Existing Git Tag
# =========================================================

if ($CREATE_TAG) {

    Info "Checking existing Git tag '$TAG'..."

    $localTag = git tag -l $TAG

    if ($localTag) {
        Error-Exit "Git tag '$TAG' already exists locally."
    }

    git ls-remote --exit-code --tags origin "refs/tags/$TAG" 2>$null

    if ($LASTEXITCODE -eq 0) {
        Error-Exit "Git tag '$TAG' already exists on remote."
    }

    Success "Git tag '$TAG' is available."
}

# =========================================================
# Docker
# =========================================================

if ($BUILD_DOCKER) {

    # -----------------------------------------------------
    # Check Docker
    # -----------------------------------------------------

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Error-Exit "Docker is not installed."
    }

    try {
        docker info | Out-Null
    }
    catch {
        Error-Exit "Docker Desktop is not running."
    }

    # -----------------------------------------------------
    # Docker Build
    # -----------------------------------------------------

    Info "Building Docker image..."

    docker build -t "${DOCKER_IMAGE}:${VERSION}" .

    if ($LASTEXITCODE -ne 0) {
        Error-Exit "Docker build failed."
    }

    Success "Docker image built."

    # -----------------------------------------------------
    # Docker Latest Tag
    # -----------------------------------------------------

    if ($PUSH_LATEST) {

        Info "Tagging Docker image as latest..."

        docker tag `
            "${DOCKER_IMAGE}:${VERSION}" `
            "${DOCKER_IMAGE}:latest"

        if ($LASTEXITCODE -ne 0) {
            Error-Exit "Docker tagging failed."
        }

        Success "Docker image tagged as latest."
    }

    # -----------------------------------------------------
    # Docker Push
    # -----------------------------------------------------

    if ($PUSH_DOCKER) {

        Info "Checking Docker login..."

        try {
            docker info 2>$null |
                Select-String "Username" |
                Out-Null

            if ($LASTEXITCODE -ne 0) {
                docker login
            }
        }
        catch {
            docker login
        }

        if ($LASTEXITCODE -ne 0) {
            Error-Exit "Docker login failed."
        }

        Info "Pushing Docker image ${DOCKER_IMAGE}:${VERSION}..."

        docker push "${DOCKER_IMAGE}:${VERSION}"

        if ($LASTEXITCODE -ne 0) {
            Error-Exit "Docker push failed."
        }

        Success "Docker version image pushed."

        if ($PUSH_LATEST) {

            Info "Pushing Docker latest image..."

            docker push "${DOCKER_IMAGE}:latest"

            if ($LASTEXITCODE -ne 0) {
                Error-Exit "Docker latest push failed."
            }

            Success "Docker latest image pushed."
        }
    }
}

# =========================================================
# Git Add
# =========================================================

Info "Checking Git changes..."

git status --short

Info "Adding Git changes..."

git add .

Success "Git add completed."

# =========================================================
# Git Commit
# =========================================================

$staged = git diff --cached --name-only

if ([string]::IsNullOrWhiteSpace($staged)) {

    Warning "No staged changes to commit."

} else {

    Info "Creating Git commit..."

    git commit -m "$COMMIT_MESSAGE"

    if ($LASTEXITCODE -ne 0) {
        Error-Exit "Git commit failed."
    }

    Success "Git commit created."
}

# =========================================================
# Git Tag
# =========================================================

if ($CREATE_TAG) {

    Info "Creating Git tag '$TAG'..."

    git tag -a $TAG -m "Release $TAG"

    if ($LASTEXITCODE -ne 0) {
        Error-Exit "Git tag creation failed."
    }

    Success "Git tag '$TAG' created."
}

# =========================================================
# Git Push
# =========================================================

if ($PUSH_GIT) {

    Info "Pushing Git branch '$GIT_BRANCH'..."

    git push origin $GIT_BRANCH

    if ($LASTEXITCODE -ne 0) {
        Error-Exit "Git branch push failed."
    }

    Success "Git branch pushed."

    if ($PUSH_GIT_TAG) {

        Info "Pushing Git tag '$TAG'..."

        git push origin $TAG

        if ($LASTEXITCODE -ne 0) {
            Error-Exit "Git tag push failed."
        }

        Success "Git tag pushed."
    }
}

# =========================================================
# Finish
# =========================================================

Write-Host ""
Write-Host "=================================================" -ForegroundColor DarkGray

if ($IS_RELEASE) {
    Write-Host "             RELEASE SUCCESSFUL" -ForegroundColor Green
} else {
    Write-Host "             UPDATE SUCCESSFUL" -ForegroundColor Green
}

Write-Host "=================================================" -ForegroundColor DarkGray
Write-Host ""

if ($IS_RELEASE) {
    Write-Host "Version       : $VERSION"

    if ($CREATE_TAG) {
        Write-Host "Git Tag       : $TAG"
    } else {
        Write-Host "Git Tag       : Not created"
    }

    if ($BUILD_DOCKER) {
        Write-Host "Docker Image  : ${DOCKER_IMAGE}:${VERSION}"

        if ($PUSH_LATEST) {
            Write-Host "Docker Latest : ${DOCKER_IMAGE}:latest"
        }
    } else {
        Write-Host "Docker        : Not built"
    }
} else {
    Write-Host "Mode          : Quick update (no version bump, no tag, no Docker build)"
}

Write-Host "Branch        : $GIT_BRANCH"
Write-Host ""