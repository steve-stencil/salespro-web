# ADR-002: Credential Encryption with AWS KMS Envelope Encryption

## Status

**Accepted**

## Context

The Office Settings feature requires storing third-party integration credentials (API keys, OAuth tokens, secrets) in the database. These credentials are highly sensitive and must be:

1. Encrypted at rest using strong encryption (AES-256-GCM)
2. Managed by a secure key management system
3. Auditable for compliance
4. Automatically rotatable without code changes

We needed to decide on an encryption strategy that balances security, operational simplicity, and compliance requirements.

## Decision

We implemented **envelope encryption with AWS KMS** with the following characteristics:

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AWS KMS                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Customer Master Key (CMK) - never leaves AWS       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼ GenerateDataKey / Decrypt
┌─────────────────────────────────────────────────────────────┐
│                   Your Application                           │
│  ┌─────────────┐    ┌─────────────────────────────────────┐ │
│  │ Data Key    │───▶│ AES-256-GCM Encrypt/Decrypt locally │ │
│  │ (plaintext) │    └─────────────────────────────────────┘ │
│  └─────────────┘                                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      Database                                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ encrypted_credentials: {iv}:{authTag}:{encrypted}      ││
│  │ encrypted_data_key: <KMS-encrypted data key (base64)>  ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### How It Works

**Encryption:**

1. Call KMS `GenerateDataKey` to get a unique 256-bit data key
2. Encrypt credentials locally using AES-256-GCM with the plaintext data key
3. Store both the encrypted credentials AND the KMS-encrypted data key
4. Discard the plaintext data key (never persisted)

**Decryption:**

1. Retrieve encrypted credentials and encrypted data key from database
2. Call KMS `Decrypt` to get the plaintext data key
3. Decrypt credentials locally using AES-256-GCM
4. Discard the plaintext data key after use

### Key Management

```bash
# KMS key ID or alias (required in production)
KMS_KEY_ID="alias/salespro-credentials"
# or
KMS_KEY_ID="arn:aws:kms:us-east-1:123456789:key/12345678-1234-1234-1234-123456789012"
```

### Key Rotation

KMS handles key rotation automatically:

- Enable automatic rotation in KMS console (annual by default)
- Old data keys remain decryptable (KMS tracks key versions internally)
- No code changes or data migration required

## Consequences

### Positive

- **Master key security**: CMK never leaves AWS HSM
- **Automatic rotation**: KMS handles key rotation with no downtime
- **Full audit trail**: All key operations logged in CloudTrail
- **Compliance ready**: SOC 1/2/3, PCI-DSS, HIPAA, FedRAMP
- **IAM integration**: Fine-grained access control via IAM policies
- **Unique data keys**: Each integration gets its own data key
- **Minimal latency**: Only 2 KMS API calls per operation

### Negative

- **AWS dependency**: Requires AWS account and KMS service
- **Cost**: ~$1/month per CMK + $0.03 per 10,000 API requests
- **Network requirement**: KMS API calls require network access

### Neutral

- **Storage overhead**: Additional column for encrypted data key (~100 bytes)
- **API latency**: ~10-50ms per KMS call (acceptable for credential operations)

## Alternatives Considered

### Alternative 1: Self-Managed Keys (Environment Variables)

**Pros:**

- No external dependencies
- Free
- Lower latency

**Why not chosen:**

- Keys stored in plaintext in environment
- No audit trail
- Manual key rotation is complex and error-prone
- Compliance concerns

### Alternative 2: HashiCorp Vault

**Pros:**

- Vendor-agnostic
- Rich feature set
- Self-hosted option

**Why not chosen:**

- Additional infrastructure to manage
- More complex setup
- Already using AWS (SES, S3)

## AWS Setup Required

### 1. Create KMS Key

```bash
aws kms create-key \
  --description "SalesPro credential encryption" \
  --key-usage ENCRYPT_DECRYPT \
  --origin AWS_KMS

# Create alias for easier reference
aws kms create-alias \
  --alias-name alias/salespro-credentials \
  --target-key-id <key-id-from-above>
```

### 2. IAM Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["kms:GenerateDataKey", "kms:Decrypt"],
      "Resource": "arn:aws:kms:*:*:key/*",
      "Condition": {
        "StringEquals": {
          "kms:RequestAlias": "alias/salespro-credentials"
        }
      }
    }
  ]
}
```

### 3. Enable Automatic Rotation (Optional)

```bash
aws kms enable-key-rotation --key-id alias/salespro-credentials
```

## Related

- Implementation: `apps/api/src/lib/kms.ts`
- Encryption utilities: `apps/api/src/lib/encryption.ts`
- Integration service: `apps/api/src/services/office-integration/`
- Entity: `apps/api/src/entities/OfficeIntegration.entity.ts`
