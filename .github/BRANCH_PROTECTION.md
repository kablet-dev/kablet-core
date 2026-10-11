# Main branch protection guidance

Repository-side CI cannot activate GitHub branch protection. A repository administrator must configure the `main` branch with:

- Require pull requests before merging.
- Require at least one approving review.
- Require the `Validate workspace`, `Secret scan`, and `Disposable PostgreSQL integration and E2E` status checks.
- Require branches to be up to date before merging.
- Require conversation resolution.
- Disable force pushes and branch deletion.

This is guidance only; activation must be verified in GitHub and recorded separately from repository evidence.
