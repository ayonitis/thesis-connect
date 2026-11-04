const assert = require('node:assert/strict');

function assertOriginalDefinition(actual,original,name) {
  const restored=actual.replace(/CREATE OR REPLACE FUNCTION/i,'CREATE FUNCTION').replace("\n  IF NOT thesis_connect_private.current_user_is_brac_eligible() THEN\n    RAISE EXCEPTION 'BRAC_ACCESS_REQUIRED' USING ERRCODE = '42501';\n  END IF;\n",'').replace('SELECT thesis_connect_private.current_user_is_brac_eligible() AND EXISTS','SELECT EXISTS');
  assert.equal(restored,original,name);
}

module.exports = { assertOriginalDefinition };
