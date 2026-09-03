/* ============================================================
   SUPABASE CLIENT + BACKEND BRIDGE
   ============================================================ */
const SUPABASE_URL = "https://oridbqjkbuyuwmuwzrzl.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_LAuHsGp08GLcl9j_xPaY5g_8U0Pbdn5";

if(typeof window.supabase === "undefined"){
  alert("DEBUG: โหลด Supabase SDK จาก CDN ไม่สำเร็จ (cdn.jsdelivr.net อาจถูกบล็อกโดยเครือข่าย เช่น WiFi โรงเรียน) กรุณาลองใช้เน็ตมือถือ หรือเครือข่ายอื่น แล้วเปิดไฟล์นี้ใหม่");
}
const sb = typeof window.supabase !== "undefined" ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// username-only login: เราสร้าง fake email ภายในให้ Supabase Auth ใช้เบื้องหลัง
function usernameToFakeEmail(username){
  return username.toLowerCase() + "@slimerunner.internal";
}

// ดึงข้อมูลผู้เล่นทั้งหมดจาก Supabase มาใส่ใน saveData (รูปแบบเดิมที่เกมใช้อยู่)
// ทำให้โค้ดเกมส่วนที่เหลือ (rendering, gameplay) ไม่ต้องแก้อะไรเลย
async function pullServerState(){
  const results = await Promise.allSettled([
    sb.from("player_stats").select("*").single(),
    sb.from("unlocked_characters").select("character_id"),
    sb.from("owned_treasures").select("treasure_id"),
    sb.from("equipped_treasures").select("slot, treasure_id").order("slot", { ascending:true })
  ]);

  const [statsRes, charsRes, treasuresRes, equippedRes] = results;

  const errs = [];
  results.forEach((r, i)=>{
    const labels = ["player_stats","unlocked_characters","owned_treasures","equipped_treasures"];
    if(r.status === "rejected"){
      errs.push(labels[i] + " threw: " + (r.reason && r.reason.message ? r.reason.message : String(r.reason)));
    } else if(r.value && r.value.error){
      errs.push(labels[i] + " error: " + r.value.error.message);
    }
  });
  if(errs.length){
    alert("DEBUG pullServerState issues:\n" + errs.join("\n"));
  }

  const stats = statsRes.status === "fulfilled" ? statsRes.value.data : null;
  const chars = charsRes.status === "fulfilled" ? charsRes.value.data : null;
  const treasures = treasuresRes.status === "fulfilled" ? treasuresRes.value.data : null;
  const equipped = equippedRes.status === "fulfilled" ? equippedRes.value.data : null;

  saveData.totalCoins = stats ? Number(stats.coins) : 0;
  saveData.bestScore = stats ? Number(stats.best_score) : 0;
  saveData.ownedCharacters = chars ? chars.map(c => c.character_id) : ["slime"];
  if(!saveData.ownedCharacters.includes("slime")) saveData.ownedCharacters.push("slime");
  saveData.ownedTreasures = treasures ? treasures.map(t => t.treasure_id) : [];
  saveData.equippedTreasures = equipped ? equipped.filter(e=>e.treasure_id).map(e => e.treasure_id) : [];

  // ตัวละครที่สวมใส่อยู่ — ซิงก์จาก server แล้ว (คอลัมน์ equipped_character_id
  // ใน player_stats) จะได้ตามกันข้ามอุปกรณ์ ไม่ต้องพึ่ง localStorage อีกต่อไป
  const serverEquipped = stats ? stats.equipped_character_id : null;
  saveData.equippedCharacter = (serverEquipped && saveData.ownedCharacters.includes(serverEquipped)) ? serverEquipped : "slime";
}