// ─────────────────────────────────────────────────────────────────────────
// This Worker does exactly two things:
//   1. If the request is a POST to /api/upload-cnic, it uploads the two
//      CNIC photos straight to the "proposal-photos" R2 bucket using the
//      CNIC_BUCKET binding below — no access keys or secrets appear
//      anywhere in this file. The binding itself is how Cloudflare grants
//      access; it's configured in wrangler.jsonc and never exposed to the
//      browser.
//   2. Everything else is passed straight through to the static site
//      (env.ASSETS), unchanged — this does not affect normal page loads.
// ─────────────────────────────────────────────────────────────────────────

const PUBLIC_R2_BASE = 'https://pub-45b25e06fb4b4f448d2ee349c6f55922.r2.dev';
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB per photo
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// ── TEMPORARY: one-time R2 orphan cleanup config ──────────────────────────
// Change this to your own secret before deploying, then pass it as the
// `x-admin-key` header on both the report and delete requests. Remove this
// entire section (and the two handler functions below) once cleanup is done.
const R2_CLEANUP_SECRET = 'sVLLh7w_OuCCaMNVRcUITNQP09-9lyPAEOFXVceuaf8';

// Snapshot of every R2 object path currently referenced by a row in the
// `proposals` table, pulled via SQL on 2026-07-05. Anything in the bucket
// NOT in this list (and not newer than the snapshot) is a candidate orphan.
const KEEP_LIST = new Set([
  "proposals/497/IMG-20260324-WA0043.jpg","proposals/284/IMG-20260316-WA0014.jpg","proposals/626/IMG-20260220-WA0020.jpg","proposals/788/IMG-20260119-WA0012.jpg","proposals/460/IMG-20260318-WA0009.jpg","proposals/489/IMG-20260324-WA0034.jpg","proposals/352/IMG-20260217-WA0005.jpg","proposals/644/IMG-20260327-WA0004.jpg","proposals/166/IMG-20260313-WA0112.jpg","proposals/607/IMG-20260403-WA0019.jpg","proposals/188/IMG-20260516-WA0000.jpg","proposals/520/IMG-20260325-WA0005.jpg","proposals/318/IMG-20260202-WA0023.jpg","proposals/450/IMG-20260114-WA0012.jpg","proposals/682/IMG-20260118-WA0022.jpg","proposals/618/IMG-20260326-WA0020.jpg","proposals/839/IMG-20260330-WA0011.jpg","proposals/348/IMG-20260105-WA0003.jpg","proposals/88/IMG-20260512-WA0031.jpg","proposals/370/IMG-20260319-WA0037.jpg","proposals/410/IMG-20260320-WA0027.jpg","proposals/106/IMG-20260313-WA0112.jpg","proposals/128/IMG-20260313-WA0100.jpg","proposals/340/IMG-20260318-WA0010.jpg","proposals/689/IMG-20260305-WA0008.jpg","proposals/429/IMG-20260406-WA0004.jpg","proposals/491/IMG-20260208-WA0001.jpg","proposals/643/IMG-20260327-WA0003.jpg","proposals/660/IMG-20260327-WA0018.jpg","proposals/638/IMG-20260326-WA0029.jpg","proposals/533/IMG-20260325-WA0021.jpg","proposals/553/IMG-20260329-WA0033.jpg","proposals/815/IMG-20260329-WA0038.jpg","proposals/525/IMG-20260325-WA0008.jpg","proposals/711/IMG-20260327-WA0043.jpg","proposals/637/IMG-20260326-WA0028.jpg","proposals/671/IMG-20260327-WA0020.jpg","proposals/287/IMG-20260316-WA0014.jpg","proposals/847/IMG-20260123-WA0024.jpg","proposals/120/IMG-20260313-WA0093.jpg","proposals/696/IMG-20260115-WA0003.jpg","proposals/471/IMG-20260119-WA0028.jpg","proposals/505/IMG-20260301-WA0018.jpg","proposals/801/IMG-20260329-WA0030.jpg","proposals/242/IMG-20260315-WA0020.jpg","proposals/518/IMG-20251211-WA0016.jpg","proposals/639/IMG-20260326-WA0031.jpg","proposals/605/IMG-20260326-WA0018.jpg","proposals/98/IMG-20260419-WA0004.jpg","proposals/490/IMG-20251220-WA0006.jpg","proposals/544/IMG-20260223-WA0006.jpg","proposals/140/IMG-20260313-WA0102.jpg","proposals/462/IMG-20260324-WA0007.jpg","proposals/181/IMG-20260407-WA0024.jpg","proposals/609/IMG-20260407-WA0020.jpg","proposals/725/IMG-20260130-WA0008.jpg","proposals/104/IMG-20260419-WA0004.jpg","proposals/279/IMG-20260324-WA0065.jpg","proposals/693/IMG-20251212-WA0037.jpg","proposals/141/IMG-20260119-WA0041.jpg","proposals/783/IMG-20260329-WA0019.jpg","proposals/245/IMG-20260315-WA0026.jpg","proposals/117/IMG-20260313-WA0093.jpg","proposals/308/IMG-20260216-WA0013.jpg","proposals/586/IMG-20260325-WA0043.jpg","proposals/784/IMG-20260329-WA0020.jpg","proposals/843/IMG-20260330-WA0018.jpg","proposals/241/IMG-20260315-WA0020.jpg","proposals/718/IMG-20260328-WA0016.jpg","proposals/496/IMG-20260324-WA0043.jpg","proposals/356/IMG-20260301-WA0016.jpg","proposals/223/IMG-20260314-WA0013.jpg","proposals/310/IMG-20260317-WA0025.jpg","proposals/437/IMG-20260323-WA0006.jpg","proposals/789/IMG-20260119-WA0012.jpg","proposals/598/IMG-20260326-WA0017.jpg","proposals/650/IMG-20260215-WA0029.jpg","proposals/215/IMG-20260314-WA0006.jpg","proposals/494/IMG-20260324-WA0039.jpg","proposals/480/IMG-20260324-WA0015.jpg","proposals/787/IMG-20260119-WA0012.jpg","proposals/258/IMG-20260323-WA0013.jpg","proposals/687/IMG-20260327-WA0027.jpg","proposals/263/IMG-20260315-WA0030.jpg","proposals/828/IMG-20260401-WA0058.jpg","proposals/479/IMG-20251228-WA0021.jpg","proposals/477/IMG-20260324-WA0012.jpg","proposals/396/IMG-20260316-WA0012.jpg","proposals/145/IMG-20260224-WA0020.jpg","proposals/499/IMG-20260324-WA0051.jpg","proposals/630/IMG-20260326-WA0024.jpg","proposals/95/IMG-20260512-WA0031.jpg","proposals/807/IMG-20260329-WA0033.jpg","proposals/377/IMG-20260319-WA0004.jpg","proposals/272/IMG-20260313-WA0111.jpg","proposals/528/IMG-20260324-WA0012.jpg","proposals/161/IMG-20260121-WA0033.jpg","proposals/209/IMG-20260320-WA0016.jpg","proposals/236/IMG-20260315-WA0012.jpg","proposals/731/IMG-20260328-WA0024.jpg","proposals/468/IMG-20260203-WA0005.jpg","proposals/328/IMG-20260318-WA0001.jpg","proposals/483/IMG-20260209-WA0034.jpg","proposals/842/IMG-20260208-WA0018.jpg","proposals/532/IMG-20260325-WA0020.jpg","proposals/560/IMG-20260325-WA0030.jpg","proposals/516/IMG-20260324-WA0078.jpg","proposals/562/IMG-20260325-WA0031.jpg","proposals/112/IMG-20260511-WA0001.jpg","proposals/354/IMG-20260120-WA0026.jpg","proposals/91/IMG-20260404-WA0016.jpg","proposals/224/IMG-20260314-WA0014.jpg","proposals/543/IMG-20260223-WA0006.jpg","proposals/248/IMG-20260315-WA0026.jpg","proposals/159/IMG-20260313-WA0104.jpg","proposals/231/IMG-20260315-WA0000.jpg","proposals/218/IMG-20260104-WA0016.jpg","proposals/385/IMG-20260320-WA0003.jpg","proposals/659/IMG-20260327-WA0018.jpg","proposals/266/IMG-20260316-WA0002.jpg","proposals/252/IMG-20260316-WA0014.jpg","proposals/137/IMG-20251226-WA0001.jpg","proposals/681/IMG-20260218-WA0025.jpg","proposals/474/IMG-20260324-WA0009.jpg","proposals/453/IMG-20260324-WA0007.jpg","proposals/107/IMG-20260313-WA0112.jpg","proposals/442/IMG-20260323-WA0013.jpg","proposals/412/IMG-20260320-WA0027.jpg","proposals/695/IMG-20260327-WA0033.jpg","proposals/519/IMG-20260325-WA0003.jpg","proposals/81/IMG-20260123-WA0023.jpg","proposals/230/IMG-20260118-WA0031.jpg","proposals/631/IMG-20260326-WA0024.jpg","proposals/212/IMG-20260114-WA0034.jpg","proposals/452/IMG-20260324-WA0007.jpg","proposals/779/IMG-20260329-WA0010.jpg","proposals/557/IMG-20260325-WA0027.jpg","proposals/379/IMG-20260112-WA0028.jpg","proposals/84/IMG-20260313-WA0002.jpg","proposals/243/IMG-20260315-WA0022.jpg","proposals/303/IMG-20260202-WA0022.jpg","proposals/582/IMG-20260325-WA0041.jpg","proposals/710/IMG-20260227-WA0031.jpg","proposals/683/IMG-20260327-WA0023.jpg","proposals/590/IMG-20260326-WA0007.jpg","proposals/656/IMG-20260324-WA0052.jpg","proposals/798/IMG-20260329-WA0030.jpg","proposals/662/IMG-20260327-WA0018.jpg","proposals/108/IMG-20260329-WA0042.jpg","proposals/686/IMG-20260327-WA0027.jpg","proposals/810/IMG-20260329-WA0033.jpg","proposals/238/IMG-20260315-WA0015.jpg","proposals/501/IMG-20260324-WA0051.jpg","proposals/834/IMG-20260330-WA0001.jpg","proposals/675/IMG-20260421-WA0024.jpg","proposals/534/IMG-20260325-WA0021.jpg","proposals/800/IMG-20260329-WA0030.jpg","proposals/717/IMG-20260328-WA0015.jpg","proposals/588/IMG-20260326-WA0007.jpg","proposals/83/IMG-20260313-WA0001.jpg","proposals/698/IMG-20251219-WA0010.jpg","proposals/123/IMG-20260313-WA0095.jpg","proposals/537/IMG-20260428-WA0025.jpg","proposals/440/IMG-20260323-WA0013.jpg","proposals/575/IMG-20260218-WA0010.jpg","proposals/765/IMG-20260104-WA0006.jpg","proposals/476/IMG-20260128-WA0022.jpg","proposals/436/IMG-20260323-WA0005.jpg","proposals/300/IMG-20260317-WA0009.jpg","proposals/707/IMG-20260415-WA0020.jpg","proposals/670/IMG-20260327-WA0020.jpg","proposals/694/IMG-20260118-WA0021.jpg","proposals/225/IMG-20251220-WA0016.jpg","proposals/500/IMG-20260324-WA0051.jpg","proposals/584/IMG-20260325-WA0042.jpg","proposals/730/IMG-20260328-WA0023.jpg","proposals/794/IMG-20260329-WA0028.jpg","proposals/415/IMG-20260422-WA0030.jpg","proposals/131/IMG-20260122-WA0002.jpg","proposals/665/IMG-20260327-WA0018.jpg","proposals/403/IMG-20260321-WA0004.jpg","proposals/636/IMG-20260130-WA0007.jpg","proposals/118/IMG-20260313-WA0093.jpg","proposals/806/IMG-20260329-WA0033.jpg","proposals/481/IMG-20260324-WA0017.jpg","proposals/510/IMG-20260324-WA0065.jpg","proposals/138/IMG-20251230-WA0010.jpg","proposals/524/IMG-20260325-WA0007.jpg","proposals/391/IMG-20260320-WA0016.jpg","proposals/531/IMG-20260325-WA0019.jpg","proposals/217/IMG-20260314-WA0007.jpg","proposals/390/IMG-20260320-WA0013.jpg","proposals/724/IMG-20260328-WA0018.jpg","proposals/274/IMG-20260313-WA0111.jpg","proposals/87/IMG-20260313-WA0002.jpg","proposals/344/IMG-20260318-WA0013.jpg","proposals/86/IMG-20260313-WA0002.jpg","proposals/164/IMG-20260313-WA0112.jpg","proposals/397/IMG-20260320-WA0024.jpg","proposals/529/IMG-20260325-WA0017.jpg","proposals/133/IMG-20260106-WA0051.jpg","proposals/386/IMG-20260320-WA0003.jpg","proposals/846/IMG-20260330-WA0019.jpg","proposals/488/IMG-20260324-WA0028.jpg","proposals/781/IMG-20260112-WA0035.jpg","proposals/432/IMG-20260322-WA0010.jpg","proposals/678/IMG-20260218-WA0025.jpg","proposals/435/IMG-20260323-WA0004.jpg","proposals/482/IMG-20260118-WA0026.jpg","proposals/599/IMG-20260326-WA0018.jpg","proposals/578/IMG-20260122-WA0008.jpg","proposals/487/IMG-20251216-WA0016.jpg","proposals/127/IMG-20260313-WA0098.jpg","proposals/506/IMG-20260324-WA0052.jpg","proposals/701/IMG-20260123-WA0016.jpg","proposals/816/IMG-20260329-WA0038.jpg","proposals/103/IMG-20260419-WA0004.jpg","proposals/339/IMG-20260318-WA0009.jpg","proposals/558/IMG-20260325-WA0029.jpg","proposals/729/IMG-20260328-WA0023.jpg","proposals/469/IMG-20260324-WA0009.jpg","proposals/369/IMG-20260319-WA0036.jpg","proposals/721/IMG-20260328-WA0017.jpg","proposals/427/IMG-20251211-WA0016.jpg","proposals/587/IMG-20260325-WA0048.jpg","proposals/545/IMG-20260223-WA0006.jpg","proposals/115/IMG-20260511-WA0001.jpg","proposals/629/IMG-20260120-WA0035.jpg","proposals/267/IMG-20260316-WA0003.jpg","proposals/268/IMG-20260125-WA0012.jpg","proposals/423/IMG-20260321-WA0022.jpg","proposals/619/IMG-20260326-WA0020.jpg","proposals/320/IMG-20260202-WA0023.jpg","proposals/368/IMG-20260319-WA0034.jpg","proposals/512/IMG-20260306-WA0017.jpg","proposals/213/IMG-20260114-WA0034.jpg","proposals/373/IMG-20260318-WA0000.jpg","proposals/327/IMG-20260103-WA0023.jpg","proposals/796/IMG-20260329-WA0030.jpg","proposals/392/IMG-20260320-WA0016.jpg","proposals/679/IMG-20260218-WA0025.jpg","proposals/758/IMG-20260430-WA0021.jpg","proposals/260/IMG-20260315-WA0028.jpg","proposals/148/IMG-20260224-WA0013.jpg","proposals/472/IMG-20260324-WA0009.jpg","proposals/657/IMG-20260327-WA0018.jpg","proposals/703/IMG-20260327-WA0042.jpg","proposals/521/IMG-20260325-WA0005.jpg","proposals/465/IMG-20260324-WA0007.jpg","proposals/307/IMG-20260317-WA0015.jpg","proposals/611/IMG-20260513-WA0015.jpg","proposals/571/IMG-20260325-WA0034.jpg","proposals/485/IMG-20260324-WA0022.jpg","proposals/129/IMG-20260219-WA0013.jpg","proposals/628/IMG-20260120-WA0035.jpg","proposals/237/IMG-20260315-WA0014.jpg","proposals/94/IMG-20260512-WA0031.jpg","proposals/92/IMG-20260512-WA0031.jpg","proposals/418/IMG-20260321-WA0022.jpg","proposals/714/IMG-20260225-WA0016.jpg","proposals/101/IMG-20260419-WA0004.jpg","proposals/372/IMG-20260319-WA0004.jpg","proposals/443/IMG-20260122-WA0004.jpg","proposals/132/IMG-20260106-WA0051.jpg","proposals/296/IMG-20260317-WA0002.jpg","proposals/160/IMG-20260313-WA0105.jpg","proposals/688/IMG-20260327-WA0027.jpg","proposals/269/IMG-20260125-WA0012.jpg","proposals/624/IMG-20260121-WA0030.jpg","proposals/130/IMG-20260106-WA0030.jpg","proposals/82/IMG-20260218-WA0025.jpg","proposals/102/IMG-20260109-WA0002.jpg","proposals/89/IMG-20260512-WA0031.jpg","proposals/713/IMG-20260327-WA0045.jpg","proposals/503/IMG-20260324-WA0051.jpg","proposals/156/IMG-20260329-WA0025.jpg","proposals/313/IMG-20260202-WA0023.jpg","proposals/581/IMG-20260104-WA0021.jpg","proposals/350/IMG-20260318-WA0018.jpg","proposals/162/IMG-20260313-WA0110.jpg","proposals/314/IMG-20260202-WA0023.jpg","proposals/239/IMG-20260315-WA0018.jpg","proposals/184/IMG-20260327-WA0000.jpg","proposals/761/IMG-20260104-WA0006.jpg","proposals/762/IMG-20260104-WA0006.jpg","proposals/139/IMG-20260119-WA0038.jpg","proposals/463/IMG-20260324-WA0007.jpg","proposals/234/IMG-20260315-WA0002.jpg","proposals/602/IMG-20260326-WA0018.jpg","proposals/744/IMG-20260329-WA0001.jpg","proposals/295/IMG-20260317-WA0001.jpg","proposals/484/IMG-20260324-WA0020.jpg","proposals/814/IMG-20260212-WA0017.jpg","proposals/297/IMG-20251219-WA0002.jpg","proposals/285/IMG-20260316-WA0014.jpg","proposals/144/IMG-20260304-WA0007.jpg","proposals/492/IMG-20260324-WA0036.jpg","proposals/620/IMG-20260326-WA0020.jpg","proposals/635/IMG-20260326-WA0027.jpg","proposals/291/IMG-20260131-WA0027.jpg","proposals/700/IMG-20260121-WA0004.jpg","proposals/417/IMG-20260217-WA0012.jpg","proposals/343/IMG-20260318-WA0012.jpg","proposals/745/IMG-20260329-WA0001.jpg","proposals/126/IMG-20260313-WA0096.jpg","proposals/411/IMG-20260320-WA0027.jpg","proposals/431/IMG-20260227-WA0021.jpg","proposals/93/IMG-20260512-WA0031.jpg","proposals/702/IMG-20260327-WA0038.jpg","proposals/135/IMG-20260106-WA0051.jpg","proposals/508/IMG-20260131-WA0017.jpg","proposals/633/IMG-20260127-WA0014.jpg","proposals/294/IMG-20260317-WA0001.jpg","proposals/419/IMG-20260322-WA0002.jpg","proposals/661/IMG-20260327-WA0018.jpg","proposals/336/IMG-20260318-WA0008.jpg","proposals/467/IMG-20260324-WA0009.jpg","proposals/211/IMG-20260317-WA0002.jpg","proposals/799/IMG-20260329-WA0030.jpg","proposals/113/IMG-20260511-WA0001.jpg","proposals/271/IMG-20260316-WA0004.jpg","proposals/705/IMG-20260327-WA0042.jpg","proposals/163/IMG-20260201-WA0022.jpg","proposals/345/IMG-20260318-WA0015.jpg","proposals/316/IMG-20260202-WA0023.jpg","proposals/278/IMG-20260223-WA0006.jpg","proposals/378/IMG-20260319-WA0004.jpg","proposals/444/IMG-20260122-WA0004.jpg","proposals/498/IMG-20260324-WA0051.jpg","proposals/219/IMG-20260314-WA0008.jpg","proposals/259/IMG-20260313-WA0111.jpg","proposals/692/IMG-20260327-WA0032.jpg","proposals/143/IMG-20251223-WA0058.jpg","proposals/321/IMG-20260202-WA0023.jpg","proposals/522/IMG-20251226-WA0014.jpg","proposals/697/IMG-20260327-WA0035.jpg","proposals/615/IMG-20260329-WA0034.jpg","proposals/493/IMG-20260324-WA0038.jpg","proposals/134/IMG-20260106-WA0051.jpg","proposals/486/IMG-20260324-WA0026.jpg","proposals/226/IMG-20260204-WA0035.jpg","proposals/347/IMG-20260105-WA0003.jpg","proposals/511/IMG-20260324-WA0074.jpg","proposals/306/IMG-20260317-WA0014.jpg","proposals/597/IMG-20260326-WA0017.jpg","proposals/690/IMG-20260305-WA0008.jpg","proposals/366/IMG-20260303-WA0027.jpg","proposals/342/IMG-20251222-WA0013.jpg","proposals/576/IMG-20260211-WA0014.jpg","proposals/254/IMG-20260511-WA0013.jpg","proposals/341/IMG-20260312-WA0015.jpg","proposals/782/IMG-20260329-WA0015.jpg","proposals/770/IMG-20260104-WA0006.jpg","proposals/658/IMG-20260327-WA0018.jpg","proposals/438/IMG-20260323-WA0009.jpg","proposals/351/IMG-20260318-WA0018.jpg","proposals/621/IMG-20260326-WA0021.jpg","proposals/154/IMG-20260315-WA0024.jpg","proposals/406/IMG-20260321-WA0021.jpg","proposals/646/IMG-20260327-WA0005.jpg","proposals/627/IMG-20260326-WA0023.jpg","proposals/739/IMG-20260329-WA0001.jpg","proposals/165/IMG-20260313-WA0112.jpg","proposals/777/IMG-20260329-WA0006.jpg","proposals/220/IMG-20260314-WA0009.jpg","proposals/216/IMG-20260314-WA0007.jpg","proposals/743/IMG-20260329-WA0001.jpg","proposals/663/IMG-20260327-WA0018.jpg","proposals/563/IMG-20260325-WA0031.jpg","proposals/304/IMG-20260317-WA0013.jpg","proposals/507/IMG-20260324-WA0053.jpg","proposals/604/IMG-20260326-WA0018.jpg","proposals/142/IMG-20251211-WA0027.jpg","proposals/580/IMG-20251221-WA0022.jpg","proposals/338/IMG-20260318-WA0009.jpg","proposals/381/IMG-20260320-WA0002.jpg","proposals/451/IMG-20260324-WA0006.jpg","proposals/645/IMG-20260327-WA0005.jpg","proposals/595/IMG-20260326-WA0012.jpg","proposals/221/IMG-20260129-WA0040.jpg","proposals/147/IMG-20260224-WA0013.jpg","proposals/554/IMG-20260325-WA0023.jpg","proposals/119/IMG-20260313-WA0093.jpg","proposals/614/IMG-20260326-WA0020.jpg","proposals/792/IMG-20260329-WA0027.jpg","proposals/812/IMG-20260329-WA0036.jpg","proposals/317/IMG-20260202-WA0023.jpg","proposals/292/IMG-20260317-WA0000.jpg","proposals/315/IMG-20260202-WA0023.jpg","proposals/302/IMG-20260317-WA0009.jpg","proposals/408/IMG-20260320-WA0027.jpg","proposals/136/IMG-20260313-WA0101.jpg","proposals/579/IMG-20260225-WA0015.jpg","proposals/716/IMG-20260328-WA0014.jpg","proposals/640/IMG-20260326-WA0035.jpg","proposals/514/IMG-20260324-WA0076.jpg","proposals/837/IMG-20260330-WA0004.jpg","proposals/233/IMG-20260315-WA0002.jpg","proposals/672/IMG-20260327-WA0020.jpg","proposals/573/IMG-20260122-WA0000.jpg","proposals/262/IMG-20260315-WA0030.jpg","proposals/380/IMG-20260102-WA0029.jpg","proposals/666/IMG-20260327-WA0018.jpg","proposals/359/IMG-20260310-WA0000.jpg","proposals/360/IMG-20260319-WA0004.jpg","proposals/728/IMG-20260328-WA0021.jpg","proposals/632/IMG-20260326-WA0024.jpg","proposals/326/IMG-20260415-WA0021.jpg","proposals/283/IMG-20260316-WA0012.jpg","proposals/791/IMG-20260113-WA0019.jpg","proposals/409/IMG-20260320-WA0027.jpg","proposals/726/IMG-20260328-WA0019.jpg","proposals/766/IMG-20260104-WA0006.jpg","proposals/840/IMG-20260330-WA0012.jpg","proposals/819/IMG-20260329-WA0042.jpg","proposals/795/IMG-20260329-WA0030.jpg","proposals/301/IMG-20260317-WA0009.jpg","proposals/382/IMG-20260320-WA0003.jpg","proposals/589/IMG-20260326-WA0007.jpg","proposals/723/IMG-20251229-WA0015.jpg","proposals/235/IMG-20251219-WA0026.jpg","proposals/774/IMG-20260329-WA0003.jpg","proposals/751/IMG-20260501-WA0005.jpg","proposals/402/IMG-20260321-WA0002.jpg","proposals/389/IMG-20260320-WA0003.jpg","proposals/691/IMG-20260305-WA0008.jpg","proposals/515/IMG-20260226-WA0016.jpg","proposals/367/IMG-20260319-WA0031.jpg","proposals/428/IMG-20260208-WA0008.jpg","proposals/146/IMG-20260224-WA0013.jpg","proposals/286/IMG-20260316-WA0014.jpg","proposals/601/IMG-20260326-WA0018.jpg","proposals/346/IMG-20260318-WA0016.jpg","proposals/153/IMG-20260318-WA0014.jpg","proposals/114/IMG-20260511-WA0001.jpg","proposals/622/IMG-20260114-WA0031.jpg","proposals/448/IMG-20260305-WA0019.jpg","proposals/401/IMG-20260321-WA0001.jpg","proposals/715/IMG-20260328-WA0012.jpg","proposals/105/IMG-20260313-WA0112.jpg","proposals/149/IMG-20260407-WA0005.jpg","proposals/293/IMG-20260317-WA0001.jpg","proposals/240/IMG-20260315-WA0019.jpg","proposals/265/IMG-20260315-WA0031.jpg","proposals/214/IMG-20260114-WA0034.jpg","proposals/570/IMG-20260204-WA0023.jpg","proposals/540/IMG-20260223-WA0007.jpg","proposals/398/IMG-20260127-WA0017.jpg"
]);
// ────────────────────────────────────────────────────────────────────────

// These two are the actual destinations your QR codes/footer links point
// to. Right now they show a "coming soon" page since the app isn't
// published yet. Once your app IS live, just replace the two
// Response("...") blocks below (in the /get-ios and /get-android checks)
// with:
//   return Response.redirect('https://apps.apple.com/app/idXXXXXXXXXX', 302);
//   return Response.redirect('https://play.google.com/store/apps/details?id=your.package.name', 302);
// Every QR code, footer link, and printed material that already points to
// /get-ios or /get-android keeps working with zero changes needed anywhere
// else.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/get-ios' || url.pathname === '/get-android') {
      return comingSoonResponse(url.pathname === '/get-ios' ? 'iOS' : 'Android');
    }

    if (url.pathname === '/api/upload-cnic' && request.method === 'POST') {
      return handleCnicUpload(request, env);
    }

    if (url.pathname === '/api/upload-profile-photo' && request.method === 'POST') {
      return handleProfilePhotoUpload(request, env);
    }

    if (url.pathname === '/api/delete-cnic-images' && request.method === 'POST') {
      return handleDeleteCnicImages(request, env);
    }

    // ── TEMPORARY: one-time R2 orphan cleanup tool ──────────────────────
    // Remove this whole block (and the KEEP_LIST / R2_CLEANUP_SECRET
    // constants below) once the cleanup has been run and confirmed.
    if (url.pathname === '/api/admin/r2-orphan-report' && request.method === 'GET') {
      return handleR2OrphanReport(request, env);
    }
    if (url.pathname === '/api/admin/r2-orphan-delete' && request.method === 'POST') {
      return handleR2OrphanDelete(request, env);
    }
    // ─────────────────────────────────────────────────────────────────────

    return env.ASSETS.fetch(request);
  },
};

function comingSoonResponse(platform) {
  const storeName = platform === 'iOS' ? 'the App Store' : 'Google Play';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coming Soon | Jor</title>
  <link rel="icon" href="https://joronline.com/favicon.png">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #534AB7 0%, #3D35A0 50%, #0F6E56 100%);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: 24px;
    }
    .card {
      max-width: 420px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 20px;
      padding: 40px 32px;
      backdrop-filter: blur(6px);
    }
    .card img { display: block; margin: 0 auto 20px; }
    .badge {
      display: block; width: fit-content; margin: 0 auto 18px; background: rgba(255,255,255,0.15); border-radius: 20px;
      padding: 5px 14px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    h1 { font-size: 1.5rem; font-weight: 800; margin: 0 0 12px; line-height: 1.3; }
    p { color: rgba(255,255,255,0.8); line-height: 1.6; margin: 0 0 28px; font-size: 15px; }
    a {
      display: inline-block;
      background: #fff;
      color: #534AB7;
      padding: 13px 30px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 800;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="card">
    <img src="https://joronline.com/logo-white.png" alt="Jor" style="height: 40px; width: auto;" />
    <div class="badge">${platform} App</div>
    <h1>We're putting the finishing touches on it 🚀</h1>
    <p>The Jor app is on its way to ${storeName}. In the meantime, you can browse rishta proposals and manage everything right from our website.</p>
    <a href="https://joronline.com">Visit joronline.com</a>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
    status: 200,
  });
}

async function handleDeleteCnicImages(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const cnicDigits = String(body.cnic || '').replace(/\D/g, '');
    if (!/^\d{13}$/.test(cnicDigits)) {
      return jsonResponse({ error: 'Invalid CNIC number' }, 400);
    }

    const prefix = `proposals/${cnicDigits}/`;
    const listed = await env.CNIC_BUCKET.list({ prefix });
    const keys = listed.objects.map(obj => obj.key);
    if (keys.length > 0) {
      await env.CNIC_BUCKET.delete(keys);
    }

    return jsonResponse({ deleted: keys.length }, 200);
  } catch (err) {
    return jsonResponse({ error: 'Delete failed. Please try again.' }, 500);
  }
}

async function handleProfilePhotoUpload(request, env) {
  try {
    const formData = await request.formData();

    const cnicDigits = String(formData.get('cnic') || '').replace(/\D/g, '');
    if (!/^\d{13}$/.test(cnicDigits)) {
      return jsonResponse({ error: 'Invalid CNIC number' }, 400);
    }

    const photo = formData.get('photo');
    if (!(photo instanceof File)) {
      return jsonResponse({ error: 'Profile photo is required' }, 400);
    }
    if (!ALLOWED_TYPES.includes(photo.type)) {
      return jsonResponse({ error: 'Invalid file type for profile photo' }, 400);
    }
    if (photo.size > MAX_FILE_BYTES) {
      return jsonResponse({ error: 'Profile photo is too large (max 8MB)' }, 400);
    }

    const ext = photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg';
    const objectPath = `proposals/${cnicDigits}/profile_${Date.now()}.${ext}`;
    const bytes = await photo.arrayBuffer();

    await env.CNIC_BUCKET.put(objectPath, bytes, {
      httpMetadata: { contentType: photo.type },
    });

    return jsonResponse({ url: `${PUBLIC_R2_BASE}/${objectPath}` }, 200);
  } catch (err) {
    return jsonResponse({ error: 'Upload failed. Please try again.' }, 500);
  }
}

async function handleCnicUpload(request, env) {
  try {
    const formData = await request.formData();

    const cnicDigits = String(formData.get('cnic') || '').replace(/\D/g, '');
    if (!/^\d{13}$/.test(cnicDigits)) {
      return jsonResponse({ error: 'Invalid CNIC number' }, 400);
    }

    const front = formData.get('front');
    const back = formData.get('back');
    if (!(front instanceof File) || !(back instanceof File)) {
      return jsonResponse({ error: 'Both CNIC front and back photos are required' }, 400);
    }

    const uploaded = {};
    for (const [key, file] of [['front', front], ['back', back]]) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return jsonResponse({ error: `Invalid file type for CNIC ${key} photo` }, 400);
      }
      if (file.size > MAX_FILE_BYTES) {
        return jsonResponse({ error: `CNIC ${key} photo is too large (max 8MB)` }, 400);
      }

      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const objectPath = `proposals/${cnicDigits}/cnic_${key}_${Date.now()}.${ext}`;
      const bytes = await file.arrayBuffer();

      await env.CNIC_BUCKET.put(objectPath, bytes, {
        httpMetadata: { contentType: file.type },
      });

      uploaded[key] = `${PUBLIC_R2_BASE}/${objectPath}`;
    }

    return jsonResponse(uploaded, 200);
  } catch (err) {
    return jsonResponse({ error: 'Upload failed. Please try again.' }, 500);
  }
}

// ── TEMPORARY: one-time R2 orphan cleanup handlers ────────────────────────
// GET  /api/admin/r2-orphan-report  -> dry-run, lists orphans, deletes nothing
// POST /api/admin/r2-orphan-delete  -> actually deletes the orphans listed
// Both require header: x-admin-key: <R2_CLEANUP_SECRET>
// Remove both functions (and their route registrations + the config block
// above) once the cleanup is done and confirmed.

async function listAllR2Objects(bucket, prefix) {
  const all = [];
  let cursor;
  do {
    const page = await bucket.list({ prefix, cursor, limit: 1000 });
    all.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return all;
}

function findOrphans(objects) {
  return objects.filter(obj => !KEEP_LIST.has(obj.key));
}

async function handleR2OrphanReport(request, env) {
  if (request.headers.get('x-admin-key') !== R2_CLEANUP_SECRET) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  try {
    const objects = await listAllR2Objects(env.CNIC_BUCKET, 'proposals/');
    const orphans = findOrphans(objects);

    const totalOrphanBytes = orphans.reduce((sum, o) => sum + (o.size || 0), 0);

    return jsonResponse({
      dryRun: true,
      totalObjectsInBucket: objects.length,
      totalKeptInDb: KEEP_LIST.size,
      orphanCount: orphans.length,
      totalOrphanBytes,
      orphanKeys: orphans.map(o => ({ key: o.key, size: o.size, uploaded: o.uploaded })),
    }, 200);
  } catch (err) {
    return jsonResponse({ error: 'Report failed: ' + err.message }, 500);
  }
}

async function handleR2OrphanDelete(request, env) {
  if (request.headers.get('x-admin-key') !== R2_CLEANUP_SECRET) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  try {
    const objects = await listAllR2Objects(env.CNIC_BUCKET, 'proposals/');
    const orphans = findOrphans(objects);
    const keys = orphans.map(o => o.key);

    // R2 delete() accepts at most 1000 keys per call.
    const batchSize = 1000;
    let deletedCount = 0;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      await env.CNIC_BUCKET.delete(batch);
      deletedCount += batch.length;
    }

    return jsonResponse({ deleted: deletedCount, deletedKeys: keys }, 200);
  } catch (err) {
    return jsonResponse({ error: 'Delete failed: ' + err.message }, 500);
  }
}
// ────────────────────────────────────────────────────────────────────────

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
