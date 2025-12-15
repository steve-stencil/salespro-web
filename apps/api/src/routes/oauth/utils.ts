import OAuth2Server from 'oauth2-server';

import { getORM } from '../../lib/db';
import { OAuthModel } from '../../lib/oauth';

/**
 * Create OAuth2Server instance with our model
 */
export function createOAuth2Server(): OAuth2Server {
  const orm = getORM();
  const model = new OAuthModel(orm.em);

  return new OAuth2Server({
    model,
    accessTokenLifetime: 3600, // 1 hour default
    refreshTokenLifetime: 1209600, // 14 days default
    allowBearerTokensInQueryString: false,
    allowEmptyState: false,
  });
}
