/**
 * Entity exports for MikroORM
 * All authentication-related entities
 */

// Core entities
export { Company } from './Company.entity';
export { CompanyLogo } from './CompanyLogo.entity';
export { User } from './User.entity';
export { Session } from './Session.entity';

// RBAC entities
export { Role } from './Role.entity';
export { UserRole } from './UserRole.entity';
export { Office } from './Office.entity';
export { UserOffice } from './UserOffice.entity';

// Multi-company access entities
export { UserCompany } from './UserCompany.entity';

// OAuth entities
export { OAuthClient } from './OAuthClient.entity';
export { OAuthToken } from './OAuthToken.entity';
export { OAuthAuthorizationCode } from './OAuthAuthorizationCode.entity';

// Auth tracking entities
export { LoginAttempt } from './LoginAttempt.entity';
export { LoginEvent } from './LoginEvent.entity';

// Password management entities
export { PasswordResetToken } from './PasswordResetToken.entity';
export { PasswordHistory } from './PasswordHistory.entity';

// User management entities
export { UserInvite } from './UserInvite.entity';
export { EmailVerificationToken } from './EmailVerificationToken.entity';

// MFA entities
export { MfaRecoveryCode } from './MfaRecoveryCode.entity';
export { TrustedDevice } from './TrustedDevice.entity';

// Session/Token entities
export { RememberMeToken } from './RememberMeToken.entity';
export { ApiKey } from './ApiKey.entity';

// File entities
export { File } from './File.entity';

// Office settings entities
export { OfficeSettings } from './OfficeSettings.entity';
export { OfficeIntegration } from './OfficeIntegration.entity';

// Price guide entities
export { PriceGuideCategory } from './PriceGuideCategory.entity';
export { PriceGuideCategoryOffice } from './PriceGuideCategoryOffice.entity';
export { MeasureSheetItem } from './MeasureSheetItem.entity';

// Types and enums
export * from './types';
