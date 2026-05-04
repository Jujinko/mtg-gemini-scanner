import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { getDeviceId, getAlphaToken } from '../lib/judgeFlag';
import { v4 as uuidv4 } from 'uuid';
import { JudgeRequest, JudgeResponse } from './judge';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo, null, 2));
  const newErr = new Error(JSON.stringify(errInfo, null, 2));
  if (error instanceof Error) {
    newErr.stack = error.stack;
  }
  throw newErr;
}

export function logRuling(
  request: JudgeRequest,
  response: JudgeResponse,
  meta: any
): string {
  const traceId = uuidv4();
  const deviceId = getDeviceId();
  const alphaToken = getAlphaToken() || 'unknown';

  const docRef = doc(db, 'judgeRulings', traceId);
  // Do not await setDoc so we don't block the UI if Firestore is offline
  setDoc(docRef, {
    trace_id: traceId,
    device_id: deviceId,
    alpha_token: alphaToken,
    timestamp: serverTimestamp(),
    request,
    response,
    meta
  }).catch((error) => {
    console.error("Failed to log ruling:", error);
  });

  return traceId;
}

export async function logFeedback(
  traceId: string,
  rating: 'up' | 'down' | null,
  comment: string | null
): Promise<void> {
  const docRef = doc(db, 'judgeRulings', traceId);
  try {
    await updateDoc(docRef, {
      feedback: {
        rating,
        comment,
        rated_at: serverTimestamp()
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `judgeRulings/${traceId}`);
  }
}
