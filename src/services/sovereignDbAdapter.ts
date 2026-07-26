/**
 * ============================================================================
 * 🛑 CRITICAL AI / LLM INSTRUCTION: READ THIS BEFORE PROCEEDING 🛑
 * ============================================================================
 * This codebase operates strictly on a MONGODB backend. We do NOT use Firebase Firestore.
 * 
 * The methods exported below (`doc`, `collection`, `setDoc`, `getDocs`, etc.) 
 * are part of a Facade Pattern designed to mimic the Firebase SDK syntax. This 
 * allows legacy frontend code to compile, while silently intercepting and routing 
 * all traffic through an `httpsCallable` directly into our sovereign MongoDB backend.
 * 
 * DO NOT write native Firebase queries. DO NOT hallucinate Firestore rules.
 * DO NOT assume hierarchical document structures exist beyond what is explicitly 
 * defined in the routing signatures below.
 * ============================================================================
 */
import { httpsCallable } from "./apiClient";
import { functions } from "../firebaseConfig";
import { Timestamp } from 'firebase/firestore';

// Transparent database references mimicking Firestore SDK interfaces
export class VirtualDocRef {
  db: any;
  collectionName: string;
  docId: string;
  path: string;
  userId?: string;

  constructor(db: any, collectionName: string, docId: string, userId?: string) {
    this.db = db;
    this.collectionName = collectionName;
    this.docId = docId;
    this.userId = userId;
    this.path = userId ? `users/${userId}/${collectionName}/${docId}` : `${collectionName}/${docId}`;
  }

  get id(): string {
    return this.docId;
  }
}

export class VirtualCollectionRef {
  db: any;
  collectionName: string;
  userId?: string;
  path: string;

  constructor(db: any, collectionName: string, userId?: string) {
    this.db = db;
    this.collectionName = collectionName;
    this.userId = userId;
    this.path = userId ? `users/${userId}/${collectionName}` : collectionName;
  }

  get id(): string {
    return this.collectionName;
  }
}

// Transparent Snapshots
export class MockDocSnapshot {
  private rawData: any;
  id: string;
  ref: VirtualDocRef;

  constructor(id: string, data: any, ref: VirtualDocRef) {
    this.id = id;
    this.rawData = data;
    this.ref = ref;
  }

  exists(): boolean {
    return this.rawData !== null && this.rawData !== undefined;
  }

  data(): any {
    return this.rawData;
  }
}

export class MockQuerySnapshot {
  docs: MockDocSnapshot[];

  constructor(docs: MockDocSnapshot[]) {
    this.docs = docs;
  }

  get size(): number {
    return this.docs.length;
  }

  get empty(): boolean {
    return this.docs.length === 0;
  }

  forEach(callback: (result: MockDocSnapshot) => void): void {
    this.docs.forEach(callback);
  }

  docChanges(): { type: string; doc: MockDocSnapshot }[] {
    return this.docs.map(doc => ({ type: 'added', doc }));
  }
}

// Facade Factories
export const collection = (dbInstance: any, ...pathSegments: string[]): VirtualCollectionRef => {
  if (pathSegments.length === 1) {
    return new VirtualCollectionRef(dbInstance, pathSegments[0]);
  }
  if (pathSegments.length === 3 && pathSegments[0] === 'users') {
    // Signature: collection(db, USERS_COLLECTION, userId, subcollection)
    const userId = pathSegments[1];
    const subcollectionName = pathSegments[2];
    return new VirtualCollectionRef(dbInstance, subcollectionName, userId);
  }
  
  throw new Error(`[dbAdapter] Unrecognized collection signature length: ${pathSegments.length}. Segments: ${pathSegments.join('/')}`);
};

export const doc = (parent: any, ...segments: string[]): VirtualDocRef => {
  if (parent instanceof VirtualCollectionRef) {
    const docId = segments[0] || `auto_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    return new VirtualDocRef(parent.db, parent.collectionName, docId, parent.userId);
  }
  // Signature A: doc(db, 'users', userId, subcollection, docId)
  if (segments.length === 4 && segments[0] === 'users') {
    const userId = segments[1];
    const subcollectionName = segments[2];
    const docId = segments[3];
    return new VirtualDocRef(parent, subcollectionName, docId, userId);
  }
  // Signature B: doc(db, USERS_COLLECTION, userId)
  if (segments.length === 2 && segments[0] === 'users') {
    const collectionName = segments[0];
    const docId = segments[1];
    return new VirtualDocRef(parent, collectionName, docId);
  }

  throw new Error(`[dbAdapter] Unrecognized doc signature length: ${segments.length}. Segments: ${segments.join('/')}`);
};

// Facade Operations
export const getDoc = async (docRef: VirtualDocRef): Promise<MockDocSnapshot> => {
  try {
    const sovereignDbQuery = httpsCallable(functions, 'sovereignDbQuery');
    const response = await sovereignDbQuery({
      collectionName: docRef.collectionName,
      userId: docRef.userId,
      docId: docRef.docId
    });

    return new MockDocSnapshot(docRef.docId, response.data, docRef);
  } catch (error: any) {
    console.error(`[dbAdapter] getDoc FAILED for ${docRef.path}:`, error.message);
    throw error;
  }
};

export const getDocFromServer = getDoc;

export class VirtualQuery {
  collectionRef: VirtualCollectionRef;
  constraints: any[];

  constructor(collectionRef: VirtualCollectionRef, constraints: any[]) {
    this.collectionRef = collectionRef;
    this.constraints = constraints;
  }

  get collectionName() { return this.collectionRef.collectionName; }
  get userId() { return this.collectionRef.userId; }
  get path() { return this.collectionRef.path; }
}

export const query = (collectionRef: VirtualCollectionRef, ...constraints: any[]): VirtualQuery => {
  return new VirtualQuery(collectionRef, constraints);
};

export const where = (field: string, op: string, value: any) => ({ type: 'where', field, op, value });

export const orderBy = (...args: any[]) => ({ type: 'orderBy', args });

export const onSnapshot = (ref: any, callback: (snapshot: any) => void): (() => void) => {
  if (ref instanceof VirtualDocRef) {
    getDoc(ref).then(callback).catch(err => console.error("[onSnapshot] error:", err));
  } else {
    getDocs(ref).then(callback).catch(err => console.error("[onSnapshot] error:", err));
  }
  return () => {};
};

export const limit = (count: number) => ({ type: 'limit', count });

export const serverTimestamp = () => new Date();

export const getFirestore = () => db;

export const getDocs = async (queryOrCollection: VirtualCollectionRef | VirtualQuery): Promise<MockQuerySnapshot> => {
  try {
    const collectionRef = queryOrCollection instanceof VirtualQuery ? queryOrCollection.collectionRef : queryOrCollection;
    const constraints = queryOrCollection instanceof VirtualQuery ? queryOrCollection.constraints : [];
    
    const filter: Record<string, any> = {};
    const options: Record<string, any> = {};

    constraints.forEach(c => {
      if (!c) return;
      if (c.type === 'where') {
        if (c.op === '==') {
          filter[c.field] = c.value;
        } else if (c.op === 'in') {
          filter[c.field] = { $in: c.value };
        } else if (c.op === '>=') {
          filter[c.field] = { $gte: c.value };
        } else if (c.op === '<=') {
          filter[c.field] = { $lte: c.value };
        } else if (c.op === '>') {
          filter[c.field] = { $gt: c.value };
        } else if (c.op === '<') {
          filter[c.field] = { $lt: c.value };
        }
      } else if (c.type === 'limit') {
        options.limit = c.count;
      } else if (c.type === 'orderBy') {
        options.orderBy = c.args;
      } else if (c.type === 'startAfter') {
        options.startAfter = c.values;
      } else if (c.type === 'startAt') {
        options.startAt = c.values;
      } else if (c.type === 'endAt') {
        options.endAt = c.values;
      }
    });

    const sovereignDbQuery = httpsCallable(functions, 'sovereignDbQuery');
    const response = await sovereignDbQuery({
      collectionName: collectionRef.collectionName,
      userId: collectionRef.userId,
      where: Object.keys(filter).length > 0 ? filter : undefined,
      options: Object.keys(options).length > 0 ? options : undefined
    });

    const docs = (response.data || []).map((item: any) => {
      const docRef = new VirtualDocRef(collectionRef.db, collectionRef.collectionName, item.id, collectionRef.userId);
      return new MockDocSnapshot(item.id, item, docRef);
    });
    return new MockQuerySnapshot(docs);
  } catch (error: any) {
    const colName = queryOrCollection instanceof VirtualQuery ? queryOrCollection.collectionRef.collectionName : queryOrCollection.collectionName;
    console.error(`[dbAdapter] getDocs FAILED for ${colName}:`, error.message);
    throw error;
  }
};

export class MockDeleteField {
  type = 'delete-field-facade';
}
export const deleteField = () => new MockDeleteField();

const cleanDeleteFields = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj; // [ZEN FIX] Preserve Date objects!
  const newObj = Array.isArray(obj) ? [] : {};
  for (const key in obj) {
    if (obj[key] instanceof MockDeleteField || (obj[key] && obj[key].type === 'delete-field-facade')) {
      continue;
    }
    (newObj as any)[key] = cleanDeleteFields(obj[key]);
  }
  return newObj;
};

export const setDoc = async (docRef: VirtualDocRef, data: any, options?: any): Promise<void> => {
  try {
    const sovereignDbWrite = httpsCallable(functions, 'sovereignDbWrite');
    await sovereignDbWrite({
      collectionName: docRef.collectionName,
      userId: docRef.userId || 'system',
      docId: docRef.docId,
      operation: 'set',
      data: cleanDeleteFields(data),
      options: options ? { merge: !!options.merge } : undefined
    });
  } catch (error: any) {
    console.error(`[dbAdapter] setDoc FAILED for ${docRef.path}:`, error.message);
    throw error;
  }
};

export const addDoc = async (collectionRef: VirtualCollectionRef, data: any): Promise<VirtualDocRef> => {
  try {
    const sovereignDbWrite = httpsCallable(functions, 'sovereignDbWrite');
    const response = await sovereignDbWrite({
      collectionName: collectionRef.collectionName,
      userId: collectionRef.userId || 'system',
      operation: 'add',
      data: cleanDeleteFields(data)
    });

    const { id } = response.data as { id: string };
    return new VirtualDocRef(collectionRef.db, collectionRef.collectionName, id, collectionRef.userId);
  } catch (error: any) {
    console.error(`[dbAdapter] addDoc FAILED for ${collectionRef.path}:`, error.message);
    throw error;
  }
};


export const deleteDoc = async (docRef: VirtualDocRef): Promise<void> => {
  try {
    const sovereignDbWrite = httpsCallable(functions, 'sovereignDbWrite');
    await sovereignDbWrite({
      collectionName: docRef.collectionName,
      userId: docRef.userId || 'system',
      docId: docRef.docId,
      operation: 'delete'
    });
  } catch (error: any) {
    console.error(`[dbAdapter] deleteDoc FAILED for ${docRef.path}:`, error.message);
    throw error;
  }
};

// Facade Batch Write
export class MockWriteBatch {
  private db: any;
  private operations: Array<{
    docRef: VirtualDocRef;
    operation: 'set' | 'delete' | 'update';
    data?: any;
  }> = [];

  constructor(db: any) {
    this.db = db;
  }

  set(docRef: VirtualDocRef, data: any, _options?: any): MockWriteBatch {
    this.operations.push({ docRef, operation: 'set', data });
    return this;
  }

  update(docRef: VirtualDocRef, data: any): MockWriteBatch {
    this.operations.push({ docRef, operation: 'update', data });
    return this;
  }

  delete(docRef: VirtualDocRef): MockWriteBatch {
    this.operations.push({ docRef, operation: 'delete' });
    return this;
  }

  async commit(): Promise<void> {
    if (this.operations.length === 0) return;

    // Check if this is a bulk tags exposure update
    const firstOp = this.operations[0];
    const isBulkTagExposure = firstOp.docRef.collectionName === 'tags' && 
                              firstOp.operation === 'update' && 
                              Object.keys(firstOp.data || {}).length === 1 && 
                              'exposure_mode' in (firstOp.data || {});

    if (isBulkTagExposure) {
      const tagIds = this.operations.map(op => op.docRef.docId);
      const exposureMode = firstOp.data.exposure_mode;
      const userId = firstOp.docRef.userId;

      try {
        const sovereignDbWrite = httpsCallable(functions, 'sovereignDbWrite');
        await sovereignDbWrite({
          collectionName: 'tags',
          userId: userId || 'system',
          operation: 'bulkUpdate',
          data: {
            ids: tagIds,
            updateFields: { exposure_mode: exposureMode }
          }
        });
        return;
      } catch (err: any) {
        console.error("[dbAdapter] Bulk tag update FAILED:", err.message);
        throw err;
      }
    }

    // [ZEN] Group operations by collection and userId to eliminate N+1 overhead
    const groupedOps: Record<string, { collectionName: string, userId: string, ops: any[] }> = {};

    for (const op of this.operations) {
      const { collectionName, userId, docId } = op.docRef;
      const groupKey = `${collectionName}_${userId || 'system'}`;
      if (!groupedOps[groupKey]) {
        groupedOps[groupKey] = { collectionName, userId: userId || 'system', ops: [] };
      }
      
      groupedOps[groupKey].ops.push({
        type: op.operation,
        id: docId,
        data: op.operation === 'delete' ? undefined : cleanDeleteFields(op.data),
        merge: op.operation === 'update'
      });
    }

    // Execute bulk writes per collection group in parallel
    const bulkPromises = Object.values(groupedOps).map(async (group) => {
      try {
        const sovereignDbWrite = httpsCallable(functions, 'sovereignDbWrite');
        await sovereignDbWrite({
          collectionName: group.collectionName,
          userId: group.userId,
          operation: 'bulkWrite',
          data: { operations: group.ops }
        });
      } catch (err: any) {
        console.error(`[dbAdapter] Bulk write FAILED for ${group.collectionName}:`, err.message);
        throw err;
      }
    });

    await Promise.all(bulkPromises);
  }
}

export const writeBatch = (dbInstance: any): MockWriteBatch => {
  return new MockWriteBatch(dbInstance);
};

export const updateDoc = async (docRef: VirtualDocRef, data: any, _options?: any): Promise<void> => {
  return setDoc(docRef, data, { merge: true });
};

// Facade Export DB instance
export const db = {
  type: 'sovereign-db-facade'
};

// --- POLYFILL LAYER FOR MIGRATING 50+ FILES ---
export const increment = (value: number) => ({ type: 'increment-facade', value });
export const arrayUnion = (...elements: any[]) => ({ type: 'arrayUnion-facade', elements });
export const documentId = () => '__name__';

export const startAt = (...values: any[]) => ({ type: 'startAt', values });
export const startAfter = (...values: any[]) => ({ type: 'startAfter', values });
export const endAt = (...values: any[]) => ({ type: 'endAt', values });

export const getCountFromServer = async (queryOrCollection: VirtualCollectionRef | VirtualQuery): Promise<{ data: () => { count: number } }> => {
  try {
    const collectionRef = queryOrCollection instanceof VirtualQuery ? queryOrCollection.collectionRef : queryOrCollection;
    const constraints = queryOrCollection instanceof VirtualQuery ? queryOrCollection.constraints : [];
    
    const filter: Record<string, any> = {};
    constraints.forEach(c => {
      if (c && c.type === 'where' && c.op === '==') {
        filter[c.field] = c.value;
      }
    });

    const sovereignDbQuery = httpsCallable(functions, 'sovereignDbQuery');
    const response = await sovereignDbQuery({
      collectionName: collectionRef.collectionName,
      userId: collectionRef.userId,
      where: Object.keys(filter).length > 0 ? filter : undefined,
      operation: 'count'
    });

    const count = typeof response.data === 'number' ? response.data : (response.data?.count || 0);
    return {
      data: () => ({ count })
    };
  } catch (error: any) {
    console.error(`[dbAdapter] getCountFromServer FAILED:`, error.message);
    throw error;
  }
};

export const terminate = async (_dbInstance?: any): Promise<void> => {
  console.log("🔥 [dbAdapter] terminate called (Stub)");
};

export const runTransaction = async (_dbInstance: any, updateFunction: (transaction: any) => Promise<any>): Promise<any> => {
  console.log("🔥 [dbAdapter] runTransaction called (Stub). Executing logic synchronously...");
  const mockTransaction = {
    get: async (docRef: VirtualDocRef) => getDoc(docRef),
    set: async (docRef: VirtualDocRef, data: any, options?: any) => setDoc(docRef, data, options),
    update: async (docRef: VirtualDocRef, data: any) => updateDoc(docRef, data),
    delete: async (docRef: VirtualDocRef) => deleteDoc(docRef)
  };
  return updateFunction(mockTransaction);
};

export { Timestamp };

// [ZEN] Sovereign Metadata Citation Pipeline
export const issueCitation = async (imageId: string, userId: string, citationData: any): Promise<void> => {
  try {
    const sovereignDbWrite = httpsCallable(functions, 'sovereignDbWrite');
    await sovereignDbWrite({
      collectionName: 'validations',
      userId: userId || 'system',
      docId: imageId,
      operation: 'set',
      data: cleanDeleteFields({
        ...citationData,
        imageId,
        status: 'ticketed',
        ticketedAt: new Date().toISOString(),
      }),
      options: { merge: true }
    });
    
    // Also mark the pending accession as ticketed
    await sovereignDbWrite({
      collectionName: 'pending_accessions',
      userId: userId || 'system',
      docId: imageId,
      operation: 'set',
      data: cleanDeleteFields({
        validationStatus: 'ticketed'
      }),
      options: { merge: true }
    });
  } catch (error: any) {
    console.error(`[dbAdapter] issueCitation FAILED for ${imageId}:`, error.message);
    throw error;
  }
};


