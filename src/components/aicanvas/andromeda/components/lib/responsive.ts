const ACCOUNT_NOTICE =
  "Almost there! \"Button (Andromeda)\" is free with an AI Canvas account (free, unlimited installs). Sign up at https://aicanvas.me/account/sign-up, then copy your personal install command from the component page."

export default function AccountRequired() {
  return (
    <div style={{ padding: 24, fontFamily: 'ui-monospace, monospace', fontSize: 13, lineHeight: 1.6, color: '#9aa3af' }}>
      {ACCOUNT_NOTICE}
    </div>
  )
}
