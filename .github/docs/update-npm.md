# Update NPM Dependencies

Use [`npm-check-updates`](https://www.npmjs.com/package/npm-check-updates).

```bash
# List all packages with their latest version
ncu

# You can selectively upgrade
ncu --interactive

# Changes the versions in package.json
ncu -u

npm i
```

> [!TIP]
>
> **Should we use `--force` flag if `npm audit fix` did not work?**
>
> tl;dr would be no, just run `npm audit --omit=dev` and it might return zero security vulnerability.
>
> This is especially helpful when running `npm audit fix` cannot fix the security vulnerability issues and `npm audit` shows a list of security vulnerabilities that would be only fixed if you force your way (**not recommended**).
