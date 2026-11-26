import { sendInteractive } from '../../lib/sendInteractive.js';

export default {
  name: 'dev',
  aliases: ['developer', 'contact', 'owner', 'creator', 'devcontact'],
  description: 'Shows owner info with interactive contact card',
  run: async (context) => {
    const { client, m } = context;
    client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } }).catch(() => {});

    const devPhone = '254716637803';
    const devName = 'Ali | TOXIC TECH';
    const devOrg = 'Toxic-MD Bot';
    const githubUrl = 'https://github.com/johntezali56/toxictech';
    const waUrl = `https://wa.me/${devPhone}`;

    try {
      await client.relayMessage(m.chat, {
        interactiveMessage: {
          header: {
            title: "𝗢 𝗪 𝗡 𝗘 𝗥   ◦   𝗗 𝗘 𝗧 𝗔 𝗜 𝗟 𝗦",
            hasMediaAttachment: false
          },
          body: {
            text: `*乂  𝗢 𝗪 𝗡 𝗘 𝗥     ◦     𝗜 𝗡 𝗙 𝗢*\n✧ Tag : \n      ◦ @${devPhone} 🇰🇪\n\n✧ Rules : \n      ◦ _Don't call owner's number_\n      ◦ _Don't talk shit_\n      ◦ _Don't spam_`
          },
          footer: {
            text: "Ali • TOXIC TECH"
          },
          nativeFlowMessage: {
            buttons: [
              {
                name: "booking_confirmation",
                buttonParamsJson: JSON.stringify({
                  icon: "default",
                  start_datetime: "2026-06-10T10:37:10.967Z",
                  end_datetime: "2026-06-10T10:47:10.967Z",
                  location: "Kenya",
                  booking_url: githubUrl,
                  phone_number: `+${devPhone}`,
                  booking_management_url: githubUrl,
                  description: `*◦ 👤 Name  :*  Ali\n*◦ 📞 Number  :*  +${devPhone}\n*◦ 💻 Repo  :*  johntezali56/toxictech\n*◦ ⚡ Status  :*  _Owner_\n*◦ Country  :*  Kenya\n`,
                  display_text: "𝐌𝐨𝐫𝐞 𝐎𝐰𝐧𝐞𝐫𝐈𝐧𝐟𝐨",
                  display_content: {
                    display_language: "en",
                    display_meeting_type: "𝐈𝐧𝐟𝐨",
                    display_bottom_sheet_header: "々   P R O F I L E     ◦     I N F O   々",
                    display_add_to_calendar_cta_text: "GITHUB",
                    display_view_on_maps_cta_text: "O W N E R     ◦     C O U N T R Y",
                    display_manage_booking_cta_text: "💻 𝐆𝐢𝐭𝐇𝐮𝐛",
                    display_manage_booking_not_supported_text: "TOXIC TECH",
                    display_read_more: "READ MORE"
                  }
                })
              },
              {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                  display_text: "🟩 𝐎𝐰𝐧𝐞𝐫 𝐍𝐮𝐦𝐛𝐞𝐫",
                  url: waUrl
                })
              }
            ],
            messageParamsJson: ""
          },
          contextInfo: {
            mentionedJid: [
              `${devPhone}@s.whatsapp.net`
            ]
          }
        }
      }, {});

      const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${devName}\nORG:${devOrg};\nTEL;type=CELL;type=VOICE;waid=${devPhone}:+${devPhone}\nEND:VCARD`;
      await client.sendMessage(m.chat, {
        contacts: {
          displayName: devName,
          contacts: [{ vcard }]
        }
      });

      client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
    } catch (error) {
      client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
      const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${devName}\nORG:${devOrg};\nTEL;type=CELL;type=VOICE;waid=${devPhone}:+${devPhone}\nEND:VCARD`;
      const fallbackText = `╭─❏ 「 OWNER INFO」\n│ 👤 Name: ${devName}\n│ 🏢 Project: ${devOrg}\n│ 📞 Contact: +${devPhone}\n│ 🔗 Repo: ${githubUrl}\n╰───────────────\n> ©Powered By TOXIC TECH`;
      await sendInteractive(client, m, fallbackText);
      await client.sendMessage(m.chat, { contacts: { displayName: devName, contacts: [{ vcard }] } });
    }
  }
};
