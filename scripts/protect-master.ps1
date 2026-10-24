# Enable all merge styles and protect master. Re-run with -Approvals 1 once collaborators join.
#   .\scripts\protect-master.ps1 [-Repo YiCheng429/activity-log] [-Approvals 0]
param(
    [string]$Repo = "YiCheng429/activity-log",
    [int]$Approvals = 0
)

function Invoke-Native([scriptblock]$Block) {
    & $Block
    if ($LASTEXITCODE -ne 0) { throw "Command failed: $Block" }
}

# Merge commit, squash and rebase all enabled so the styles can be compared.
Invoke-Native {
    gh api -X PATCH "repos/$Repo" -F allow_merge_commit=true -F allow_squash_merge=true `
        -F allow_rebase_merge=true -F delete_branch_on_merge=true | Out-Null
}

# PR required, every CI job green on an up-to-date branch, linear history OFF.
# enforce_admins=false leaves the owner an audited bypass, used only for the fast-forward demo.
$protection = @{
    required_status_checks        = @{
        strict   = $true
        contexts = @("lint", "test (20)", "test (22)", "test (24)", "build")
    }
    enforce_admins                = $false
    required_pull_request_reviews = @{
        dismiss_stale_reviews           = $true
        required_approving_review_count = $Approvals
    }
    restrictions                  = $null
    required_linear_history       = $false
    allow_force_pushes            = $false
    allow_deletions               = $false
} | ConvertTo-Json -Depth 5

# Windows PowerShell 5.1 mangles JSON piped to native tools, so pass it via a BOM-less temp file.
$tmp = New-TemporaryFile
[IO.File]::WriteAllText($tmp.FullName, $protection, (New-Object Text.UTF8Encoding $false))
try {
    Invoke-Native { gh api -X PUT "repos/$Repo/branches/master/protection" --input $tmp.FullName | Out-Null }
} finally {
    Remove-Item $tmp.FullName
}
Write-Host "master protected on $Repo (approvals: $Approvals)"
