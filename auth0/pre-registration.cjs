exports.onExecutePreUserRegistration = async (event, api) => {
  if (event.client?.client_id !== 'hJYhsluI7zSN0JvevTtUODyMvInFN036') return;
  const allowed = new Set(["kusaka@cbs-f.com","ju@wayequity.co","nakai@cbs-f.com","y-tomokata@cbs-hd.club","nakahara@wayequity.co","nakahara@soramanagement.co","horie@wayequity.co","chen@wayequity.co"]);
  const email = (event.user.email || '').trim().toLowerCase();
  if (event.connection.strategy !== 'email' || !allowed.has(email)) {
    api.access.deny('signup_not_allowed', 'このメールアドレスではログインできません。ご案内済みのメールアドレスをご使用ください。');
  }
};
