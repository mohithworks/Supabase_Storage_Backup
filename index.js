const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require("dotenv").config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function downloadObject(bucketName, objectPath, basePath) {
  try {
    const res = await supabase.storage.from(bucketName).download(objectPath);
    const blob = res.data;
    const buffer = Buffer.from( await blob.arrayBuffer() );
    console.log(bucketName + ' ' + basePath);
    fs.writeFileSync(basePath, buffer);
  } catch (e) {
    console.error('Error downloading', objectPath, e);
  }
}

async function traverseFolders(bucketName, folderPath, basePath) {
  try {
    const objects = await supabase.storage.from(bucketName).list(folderPath);
    //console.log(objects.data)
    
    for (const obj of objects.data) {
      if(obj.name != ".emptyFolderPlaceholder") {
        const objectPath = path.join(folderPath, obj.name);
        const supabaseFolderPath = objectPath.replace(/\\/g, '/')
        const objectBasePath = path.join(basePath, objectPath);

        if (!obj.metadata) {
          // If the object is inside a subfolder, create the directory and traverse recursively
          if (!fs.existsSync(objectBasePath)) {
            fs.mkdirSync(objectBasePath, { recursive: true });
          }
          await traverseFolders(bucketName, supabaseFolderPath, basePath);
        } else {
          // If the object is a file, create the directory and download it
          const fileBasePath = path.join(basePath, folderPath);
          if (!fs.existsSync(fileBasePath)) {
            fs.mkdirSync(fileBasePath, { recursive: true });
          }
          await downloadObject(bucketName, supabaseFolderPath, objectBasePath);
        }

      } else {
        continue;
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

async function backupBuckets() {
  try {
    const buckets = await supabase.storage.listBuckets();

    for (const bucket of buckets.data) {
      console.log('Backing up bucket:', bucket.name);
      const basePath = path.join(__dirname, String(bucket.name));
      if (!fs.existsSync(basePath)) {
        fs.mkdirSync(basePath, { recursive: true });
      }

      await traverseFolders(bucket.name, 'public', basePath);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

backupBuckets();
