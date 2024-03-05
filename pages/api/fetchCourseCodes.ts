import fs from 'fs/promises';
import path from 'path';

export default async function handler(req, res) {
  try {
    const codesMappingFilePath = path.join(process.cwd(), 'utils', 'classCodesMapping.json');
    const data = await fs.readFile(codesMappingFilePath, 'utf8');
    console.log(data); // Log the raw data to inspect it.
    const codeMapping = JSON.parse(data); // Attempt to parse the JSON.

    res.status(200).json({ mapping: codeMapping });
  } catch (e) {
    console.log('Error in class mapping', e); // Log the error message for more detail.
    res.status(500).json({ error: 'Internal Server Error', details: e});
  }
}
