# Azure secrets-to-environment
This project is a [Protocol Extension](https://docs.harperdb.io/docs/developers/components/reference#protocol-extension) that accesses an Azure key vault and assigns the keys to environment variables.

## Installation
Install this package in your Harper application: `npm install --save @harperfast/azure-secrets-to-environment`

## Configuration

After installation, add the extension (`@harperdb/azure-secrets-to-environment`) into your application's `config.yaml` file.
This component must be listed above any components that will access the environment variables.

```
'@harperdb/azure-secrets-to-environment':
  package: '@harperdb/azure-secrets-to-environment'
'@harperdb/http-router':
  package: '@harperdb/http-router'
  files: '*.*js' # to load the routes.js and config files
'@harperdb/nextjs':
  package: '@harperdb/nextjs'
  files: '/*'
```

There are 2 ways to provide this extension with the credentials needed to access your Azure vault, depending on the `managedCredentials: boolean` configuration option:

### 1. Using environment variables (`managedCredentials: false (default)`)

The following environment variables (i.e. through `process.env`) must be accessible to your deployed component:

* AZURE_VAULT_NAME - (required) Name of the Azure Key Vault holding the secrets
* AZURE_TENANT_ID - (required) Tenant ID of the Azure Subscription
* AZURE_CLIENT_ID - (required) Client ID of the application registration
* AZURE_CLIENT_SECRET - (required) Client Secret of the application registration
* SECRETS_LIST - (optional) Comma seperated list of secrets to access from the vault


### 2. Using a dotfile (`managedCredentials: true`)

When you do not want to deploy your credentials with your component code, you can set `managedCredentials` to `true`, and the credentials (i.e. `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and `AZURE_CLIENT_SECRET`) will be securely pulled from within the deployed environment.

For this to work, your deployed component must have access to dotfile containing:

* AZURE_VAULT_NAME - (required) Name of the Azure Key Vault holding the secrets
* SECRETS_LIST - (optional) Comma seperated list of secrets to access from the vault 

In order for your extension to access the dotfile, you must also set the `files` property in your `config.yaml` with the path to the dotfile

```
'@harperdb/azure-secrets-to-environment':
  package: '@harperdb/azure-secrets-to-environment'
  managedCredentials: true
  files: '/path/to/.dotfile'
'@harperdb/http-router':
  package: '@harperdb/http-router'
  files: '*.*js' # to load the routes.js and config files
'@harperdb/nextjs':
  package: '@harperdb/nextjs'
  files: '/*'
```

#### Managed Credentials

To prevent the storage/exposure of credentials in your deployed component code, the credentials can be "managed" outside of the component scope. Currently, the host machine
of the Harper container will inject an `AZURE_VAULT_MAP` as environment variable which will allow remote deployments to require just the `AZURE_VAULT_NAME`