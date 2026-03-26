import { isPrivateOrLocalhost, validateUrl } from '@/lib/security/ssrf';

describe('SSRF Protection', () => {
  describe('isPrivateOrLocalhost', () => {
    it('should block localhost', () => {
      expect(isPrivateOrLocalhost('localhost')).toBe(true);
      expect(isPrivateOrLocalhost('127.0.0.1')).toBe(true);
      expect(isPrivateOrLocalhost('0.0.0.0')).toBe(true);
      expect(isPrivateOrLocalhost('::1')).toBe(true);
    });

    it('should block private IP ranges', () => {
      expect(isPrivateOrLocalhost('0.1.2.3')).toBe(true);
      expect(isPrivateOrLocalhost('10.0.0.1')).toBe(true);
      expect(isPrivateOrLocalhost('172.16.0.1')).toBe(true);
      expect(isPrivateOrLocalhost('192.168.1.1')).toBe(true);
      expect(isPrivateOrLocalhost('100.64.10.1')).toBe(true);
      expect(isPrivateOrLocalhost('127.10.20.30')).toBe(true);
      expect(isPrivateOrLocalhost('169.254.1.5')).toBe(true);
      expect(isPrivateOrLocalhost('[::1]')).toBe(true);
      expect(isPrivateOrLocalhost('[fd00::1]')).toBe(true);
      expect(isPrivateOrLocalhost('[fe80::1]')).toBe(true);
    });

    it('should block cloud metadata endpoints', () => {
      expect(isPrivateOrLocalhost('169.254.169.254')).toBe(true);
      expect(isPrivateOrLocalhost('metadata.google.internal')).toBe(true);
    });

    it('should block obfuscated/private host representations', () => {
      expect(isPrivateOrLocalhost('2130706433')).toBe(true); // 127.0.0.1 dword
      expect(isPrivateOrLocalhost('0x7f.0x0.0x0.0x1')).toBe(true); // hex dotted
      expect(isPrivateOrLocalhost('0177.0.0.1')).toBe(true); // octal dotted
      expect(isPrivateOrLocalhost('api.internal.local')).toBe(true);
      expect(isPrivateOrLocalhost('LOCALHOST.')).toBe(true);
      expect(isPrivateOrLocalhost('::ffff:127.0.0.1')).toBe(true);
    });

    it('should allow public IPs', () => {
      expect(isPrivateOrLocalhost('8.8.8.8')).toBe(false);
      expect(isPrivateOrLocalhost('1.1.1.1')).toBe(false);
      expect(isPrivateOrLocalhost('example.com')).toBe(false);
    });
  });

  describe('validateUrl', () => {
    it('should allow valid HTTPS URLs', () => {
      const result = validateUrl('https://example.com/api');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should block HTTP by default', () => {
      const result = validateUrl('http://example.com/api');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Protocol');
    });

    it('should allow HTTP when explicitly permitted', () => {
      const result = validateUrl('http://example.com/api', ['http', 'https']);
      expect(result.valid).toBe(true);
    });

    it('should block localhost URLs', () => {
      const result = validateUrl('https://localhost:3000/api');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('private or localhost');
    });

    it('should block private IP URLs', () => {
      const result = validateUrl('https://192.168.1.1/api');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('private or localhost');
    });

    it('should block bracketed IPv6 localhost/private URLs', () => {
      expect(validateUrl('https://[::1]/api').valid).toBe(false);
      expect(validateUrl('https://[fd00::1234]/api').valid).toBe(false);
      expect(validateUrl('https://[fe80::1]/api').valid).toBe(false);
    });

    it('should block metadata endpoints', () => {
      const result = validateUrl('https://169.254.169.254/latest/meta-data');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('private or localhost');
    });

    it('should reject invalid URL format', () => {
      const result = validateUrl('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid URL format');
    });

    it('should block obfuscated localhost/private URL hosts', () => {
      expect(validateUrl('https://2130706433/api').valid).toBe(false);
      expect(validateUrl('https://0x7f.0x0.0x0.0x1/api').valid).toBe(false);
      expect(validateUrl('https://service.local/api').valid).toBe(false);
    });

    it('should block file protocol', () => {
      const result = validateUrl('file:///etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Protocol');
    });

    it('should block URLs with embedded credentials', () => {
      const result = validateUrl('https://user:pass@example.com/api');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Username/password');
    });
  });
});
