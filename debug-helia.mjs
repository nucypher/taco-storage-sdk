#!/usr/bin/env node

import { createHelia } from 'helia';
import { unixfs } from '@helia/unixfs';

async function debugHelia() {
  console.log('Creating Helia...');
  const helia = await createHelia();
  console.log('Creating UnixFS...');
  const fs = unixfs(helia);
  
  console.log('Adding test data...');
  const testData = new Uint8Array([1, 2, 3, 4, 5]);
  const cid = await fs.addBytes(testData);
  console.log('CID:', cid.toString());
  
  console.log('Attempting to cat...');
  const contentIterable = fs.cat(cid);
  console.log('contentIterable type:', typeof contentIterable);
  console.log('contentIterable constructor:', contentIterable.constructor.name);
  console.log('contentIterable is async iterable:', Symbol.asyncIterator in contentIterable);
  
  try {
    console.log('Attempting async iteration...');
    const chunks = [];
    for await (const chunk of contentIterable) {
      console.log('Got chunk:', chunk);
      chunks.push(chunk);
    }
    console.log('Success! Retrieved:', Buffer.concat(chunks));
  } catch (error) {
    console.error('Error during iteration:', error.message);
  }
  
  await helia.stop();
}

debugHelia().catch(console.error);
