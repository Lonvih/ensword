const common = {
  /**
   * Get file extension.
   */
  getExtension: function (filename, defaultExt) {
    return /(?:\.([^.]+))?$/.exec(filename)[1] || defaultExt;
  },
  
   /**
    * Regular expression to strip key if dictionary's "StripKey" attribute is true. 
    */
  REGEXP_STRIPKEY: {
    'mdx' : /[()., '/\\@_-]()/g,
    'mdd' : /([.][^.]*$)|[()., '/\\@_-]/g        // strip '.' before file extension that is keeping the last period
  },

  log: function() {
    console.log.apply(console, [].slice.apply(arguments));
  }
};

export default common