const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://pzhuszyyykususkmzpud.supabase.co',
  'sb_publishable_rOOgbfNSW4VbmmJPmMDK6Q_qj0lY6rQ'
);

async function test() {
  console.log('Testing Full ItemFinder Pipeline...');
  const id = '7ed760bd-885a-4353-8468-c0dd2444f6cf'; // The NFC UID from previous tests

  try {
    // 1. Fetch Item
    const { data: item, error: fetchErr } = await supabase
      .from('items')
      .select('id, user_id, item_name, category, color, image_url')
      .eq('nfc_uid', id)
      .single();

    if (fetchErr) throw fetchErr;
    console.log('1. Fetch Item: Success', item.id);

    // 2. Resolve Auth ID
    const { data: ownerAuthId, error: ownerErr } = await supabase
      .rpc('get_user_auth_id', { profile_id: item.user_id });
    
    if (ownerErr || !ownerAuthId) {
      throw ownerErr ?? new Error('Could not resolve item owner');
    }
    console.log('2. Resolve Auth ID: Success', ownerAuthId);

    // 3. Log Scan
    const { error: scanErr } = await supabase.from('nfc_scans').insert({
      nfc_uid: id,
      lat: 0,
      lng: 0
    });
    if (scanErr) throw new Error('Scan Insert Error: ' + scanErr.message);
    console.log('3. Log Scan: Success');

    // 4. Create Conversation
    const convId = crypto.randomUUID();
    const { error: convError } = await supabase
      .from('conversations')
      .insert({
        id: convId,
        item_id: item.id,
        owner_id: ownerAuthId,
        finder_user_id: null,
        finder_name: 'Anonymous finder',
        scan_lat: 0,
        scan_lng: 0,
      });

    if (convError) {
      throw convError ?? new Error('Could not create conversation');
    }
    console.log('4. Create Conversation: Success', convId);

    // 5. Initial Message
    const { error: msgErr } = await supabase.from('messages').insert({
      conversation_id: convId,
      sender_id: null,
      sender_name: 'Anonymous finder',
      body: `I found your "${item.item_name}"! Tap to connect with me.`,
    });
    if (msgErr) throw new Error('Message Insert Error: ' + msgErr.message);
    console.log('5. Initial Message: Success');

    // 6. Push Notification
    const { error: pushError } = await supabase.functions.invoke('send-push-notification', {
      body: {
        owner_id: ownerAuthId,
        conversation_id: convId,
        item_name: item.item_name,
        finder_name: 'Anonymous finder',
        location_label: `0.0000, 0.0000`,
      },
    });
    if (pushError) console.error('Push notification failed:', pushError);
    console.log('6. Push Notification: Success (or skipped error)');
    
  } catch (err) {
    console.error('\n!!! PIPELINE FAILED !!!');
    console.error(err);
  }
}

test();
