import {
  handleOracleCheckNullifierPagesRequest,
} from '../../../lib/libraries/backend-core/http/pages/check-nullifier-pages';
import {
  type PagesFunctionContextLike,
} from '../../../lib/libraries/backend-core/http/pages/runtime-shared';

export async function onRequest(context: PagesFunctionContextLike): Promise<Response> {
  return handleOracleCheckNullifierPagesRequest(context);
}
