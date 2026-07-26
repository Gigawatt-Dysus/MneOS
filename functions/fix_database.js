const { MongoClient } = require('mongodb');
async function run() {
  const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017');
  await client.connect();
  const db = client.db('LifeOS');
  const docId = 'af82323c-6c31-43b2-ad5e-6b4719cafda9';
  const ghostId = '9MPVGVTxE8dXvkCrl1XrWHQzCl23_' + docId;

  const caption = `In the hush of a sunlit clinical space, a lone figure in crisp azure scrubs and mask lifts a small black camera toward the mirror, their reflection suspended between sterile bottles and the warm spill of light from the doorway. The fabric clings softly to their form, while translucent specimen jars catch golden hues on the counter, evoking a quiet intimacy amid the clinical stillness. Behind the lens, a gentle steadiness lingers, bridging the masked gaze with the tender act of self-witness.`;

  await db.collection('media').updateOne(
    { _id: docId },
    { $set: { aiDescription: caption, reviewStatus: 'completed' } }
  );

  // Delete ghost clone if it exists
  await db.collection('media').deleteOne({ _id: ghostId });

  console.log('Fixed DB!');
  await client.close();
}
run();
