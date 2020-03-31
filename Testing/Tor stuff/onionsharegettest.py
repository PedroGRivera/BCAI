import requests

session = requests.session()
session.proxies = {}
session.proxies['http'] = 'socks5h://localhost:9050'
session.proxies['https'] = 'socks5h://localhost:9050'

r = session.get('http://onionshare:outburst-monotone@he4ois3i7x6ao263.onion/hello.txt')
print(r.text)