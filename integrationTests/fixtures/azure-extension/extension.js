import dotenv from 'dotenv'
import { ClientSecretCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import assert from 'node:assert';

export async function start({ managedCredentials }) {
  const ERROR_PREAMBLE = 'Unable to access Azure Secrets Vault due to: ';

  if (!managedCredentials) {
    assert(process.env.AZURE_VAULT_NAME, `${ERROR_PREAMBLE} AZURE_VAULT_NAME is required.`);
    assert(process.env.AZURE_TENANT_ID, `${ERROR_PREAMBLE} AZURE_TENANT_ID is required.`);
    assert(process.env.AZURE_CLIENT_ID, `${ERROR_PREAMBLE} AZURE_CLIENT_ID is required.`);
    assert(process.env.AZURE_CLIENT_SECRET, `${ERROR_PREAMBLE} AZURE_CLIENT_SECRET is required.`);

    await fetchAndSetSecrets(process.env);

    return {};
  }

  return {
    async handleFile(contents) {
      const { AZURE_VAULT_NAME, SECRETS_LIST } = dotenv.parse(contents);

      if (!AZURE_VAULT_NAME) {
        throw new Error(`${ERROR_PREAMBLE} AZURE_VAULT_NAME is required.`);
      }

      const vaultCreds = fetchVaultCreds(AZURE_VAULT_NAME);

      if (!vaultCreds) {
        throw new Error(`${ERROR_PREAMBLE} No credentials found for "${AZURE_VAULT_NAME}"`);
      }

      await fetchAndSetSecrets({ ...vaultCreds, AZURE_VAULT_NAME, SECRETS_LIST });
    }
  };
}

function fetchVaultCreds(vaultName) {
  let vaultCreds;

  if (process.env.AZURE_VAULT_MAP) {
    let vaultMap;
    try {
      vaultMap = JSON.parse(process.env.AZURE_VAULT_MAP);
    } catch (e) {
      console.warn(`Unable to parse AZURE_VAULT_MAP: ${e.message
        ? e.message
        : e.toString()
        }`);
    }

    vaultCreds = vaultMap?.[vaultName];
  }

  return vaultCreds
}


async function fetchAndSetSecrets({ AZURE_VAULT_NAME, AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, SECRETS_LIST }) {
  // Configure vault URL
  const vaultUrl = `https://${AZURE_VAULT_NAME}.vault.azure.net`;

  //Set credentials based on Service Registration
  const credential = new ClientSecretCredential(
    AZURE_TENANT_ID,
    AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET,
  );

  // Create authenticated secret client
  const client = new SecretClient(vaultUrl, credential);

  const secretsList = SECRETS_LIST ? SECRETS_LIST.split(',') : [];

  const promises = [];

  if (secretsList.length > 0) {
    promises = secretsList.map((secretName) => fetchAndSetSecret(client, secretName));
  } else {
    //if there is no predefined list of secrets iterate all secrets in vault
    for await (const { name } of client.listPropertiesOfSecrets()) {
      promises.push(fetchAndSetSecret(client, name));
    }
  }

  await Promise.all(promises);
}

async function fetchAndSetSecret(client, secretName) {
  try {
    const secret = await client.getSecret(secretName);
    //set secret to process.env.  Because Azure KV does not support underscores, we put the secret names with dashes.  On retrieval we replace dashes with underscore
    secretName = [secret.name.replace(/-/g, '_')];
    process.env[secretName] = secret.value;
  } catch (error) {
    console.warn(error.message);
  }
}