const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://zrhussirvsgsoffmrkxb.supabase.co';
// 使用剛才確認有效的 Service Role Key
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyaHVzc2lydnNnc29mZm1ya3hiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA1NzMyMiwiZXhwIjoyMDg2NjMzMzIyfQ.OhTtPoQ70Vz8ceLRYSCoXj9QuoYPwT29htvYFdLqHO0';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const emailsToUpgrade = [
    'laiho102222@gmail.com',
    'wenhao0116@gmail.com',
    'kenny0883@gmail.com',
    'bob20200103@gmail.com'
];

async function promoteUsers() {
    console.log('正在升級以下用戶為 advanced ...');
    emailsToUpgrade.forEach(e => console.log(` - ${e}`));

    const { data, error } = await supabase
        .from('profiles')
        .update({ role: 'advanced' })
        .in('email', emailsToUpgrade)
        .select();

    if (error) {
        console.error('❌ 更新失敗:', error.message);
    } else {
        console.log(`✅ 更新成功！共更新了 ${data.length} 位用戶：`);
        data.forEach(u => console.log(` - [${u.email}] 新權限: ${u.role}`));

        // 檢查是否有漏掉的 (如果 data.length < 4)
        if (data.length < emailsToUpgrade.length) {
            const updatedEmails = data.map(u => u.email);
            const missing = emailsToUpgrade.filter(e => !updatedEmails.includes(e));
            console.log('⚠️ 警告：以下用戶未找到或未更新 (可能尚未註冊):', missing);
        }
    }
}

promoteUsers();
