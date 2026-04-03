/**
 * 請求書発行アプリ - Google Apps Script バックエンド
 *
 * セットアップ手順:
 * 1. Google スプレッドシートを新規作成
 * 2. 拡張機能 > Apps Script を開く
 * 3. このコードを貼り付け
 * 4. SPREADSHEET_ID を自分のスプレッドシートIDに変更
 * 5. デプロイ > 新しいデプロイ > ウェブアプリ
 *    - アクセスできるユーザー: 全員
 * 6. デプロイURLをフロントエンドの設定画面に入力
 */

const SPREADSHEET_ID = '11HVp_uaWvE3OvxcyptQ0oYrA1GDPA5ijX3rFc4zsw_c';

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getOrCreateSheet(name, headers) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

function doGet(e) {
  const action = (e.parameter && e.parameter.action) || 'clients';
  let result;
  try {
    switch (action) {
      case 'clients':
        result = getClients();
        break;
      case 'deliveries':
        result = getDeliveries(e.parameter.clientId, e.parameter.year, e.parameter.month);
        break;
      default:
        result = { error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { error: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let result;
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || '';
    switch (action) {
      case 'addClient':
        result = addClient(data);
        break;
      case 'deleteClient':
        result = deleteClient(data);
        break;
      case 'saveDelivery':
        result = saveDelivery(data);
        break;
      case 'deleteDelivery':
        result = deleteDelivery(data);
        break;
      default:
        result = { error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { error: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// === 得意先管理 ===

function getClients() {
  const sheet = getOrCreateSheet('得意先', ['ID', '名称', '作成日']);
  const data = sheet.getDataRange().getValues();
  const clients = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      clients.push({ id: data[i][0], name: data[i][1] });
    }
  }
  return { clients: clients };
}

function addClient(data) {
  const sheet = getOrCreateSheet('得意先', ['ID', '名称', '作成日']);
  const id = Utilities.getUuid();
  sheet.appendRow([id, data.name, new Date().toISOString()]);
  return { success: true, id: id, name: data.name };
}

function deleteClient(data) {
  const sheet = getOrCreateSheet('得意先', ['ID', '名称', '作成日']);
  const allData = sheet.getDataRange().getValues();
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][0] === data.id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: '得意先が見つかりません' };
}

// === 納品記録管理 ===

const DELIVERY_HEADERS = ['ID', '得意先ID', '納品日', '品名', '数量', '単価', '税率', '作成日'];

function saveDelivery(data) {
  const sheet = getOrCreateSheet('納品記録', DELIVERY_HEADERS);

  if (data.id) {
    // 既存の更新
    const allData = sheet.getDataRange().getValues();
    for (let i = 1; i < allData.length; i++) {
      if (allData[i][0] === data.id) {
        sheet.getRange(i + 1, 3, 1, 5).setValues([[
          data.date, data.name, data.qty, data.price, data.tax
        ]]);
        return { success: true, id: data.id };
      }
    }
  }

  const id = data.id || Utilities.getUuid();
  sheet.appendRow([id, data.clientId, data.date, data.name, data.qty, data.price, data.tax, new Date().toISOString()]);
  return { success: true, id: id };
}

function deleteDelivery(data) {
  const sheet = getOrCreateSheet('納品記録', DELIVERY_HEADERS);
  const allData = sheet.getDataRange().getValues();
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][0] === data.id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: '納品記録が見つかりません' };
}

function getDeliveries(clientId, year, month) {
  const sheet = getOrCreateSheet('納品記録', DELIVERY_HEADERS);
  const data = sheet.getDataRange().getValues();
  const deliveries = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    if (clientId && data[i][1] !== clientId) continue;
    if (year && month) {
      const dt = new Date(data[i][2]);
      if (dt.getFullYear() !== parseInt(year) || dt.getMonth() + 1 !== parseInt(month)) continue;
    }
    deliveries.push({
      id: data[i][0],
      clientId: data[i][1],
      date: data[i][2],
      name: data[i][3],
      qty: data[i][4],
      price: data[i][5],
      tax: data[i][6]
    });
  }
  return { deliveries: deliveries };
}

// === 初期セットアップ用 ===
function setup() {
  getOrCreateSheet('得意先', ['ID', '名称', '作成日']);
  getOrCreateSheet('納品記録', DELIVERY_HEADERS);
  Logger.log('セットアップ完了');
}
