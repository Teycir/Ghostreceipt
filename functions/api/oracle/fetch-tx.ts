import {
  handleOracleFetchTxPagesRequest,
} from '../../../lib/libraries/backend-core/http/pages/fetch-tx-pages';
import {
  type PagesFunctionContextLike,
} from '../../../lib/libraries/backend-core/http/pages/runtime-shared';

export async function onRequest(context: PagesFunctionContextLike): Promise<Response> {
  return handleOracleFetchTxPagesRequest(context);
}
