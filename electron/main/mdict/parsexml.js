export default function (str) {
  return (new DOMParser()).parseFromString(str, 'text/xml');
}