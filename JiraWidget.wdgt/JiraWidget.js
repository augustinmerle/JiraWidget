/*
Copyright (c) 2006, Mark Johnson
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the 
following conditions are met:

    * Redistributions of source code must retain the above copyright notice, this list of conditions and the 
      following disclaimer.
    * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and 
      the following disclaimer in the documentation and/or other materials provided with the distribution.
    * Neither the name of the <ORGANIZATION> nor the names of its contributors may be used to endorse or 
      promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND 
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED 
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE 
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL 
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR 
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED 
AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT 
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS 
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
var initKeyPrefix = "apple-init-";

var last_updated = 0;
var xml_request = null;

var slider;
var info;
var contents;

var numIssues = 0;
var filterName = "";

function load()
{    

	slider = document.getElementById("slider");
	info = document.getElementById("textinfo");
	//get a reference to the content area			
	contents = document.getElementById('content');
	
	loadPreferences();
	
	setInfoMessage("");
	
}

function remove()
{
	// your widget has just been removed from the layer
	// remove any preferences as needed
	removePreferences();
}

function hide()
{
	// your widget has just been hidden stop any timers to
	// prevent cpu usage
}

function show()
{
	// your widget has just been shown.  restart any timers
	// and adjust your interface as needed
	var now = (new Date).getTime();
	
	// only check if interval minutes set in preferences have passed
	if ((now - last_updated) > jirarefreshpref.value *60000) {
	    populateIssueList();

    }
}
/**
* Main function which will attempt to retrieve all issues
* for JIRA.  If an exception occurs it will be displayed
* to the user and the script will exit.
* If we do find issues it will populate the issue list
* displaying the issues in order of preference*.
*/ 
function populateIssueList() 
{
	// Remove the old entries
	removeEntriesFromContents();

	// make sure we have all mandatory preferences supplied
	if (!checkMandatoryPreferences())
	{
		return;
	}			
	
	setInfoMessage("Retrieving...");
	
	//pass in required fields to jirasoap.js function
	retrieveIssues(getJiraUsername(), getJiraPassword(), getJiraUrlLocation(), getJiraFilterId());
	
	endScale();
}

/**
* Make sure we have all the mandatory fields before
* attempting to retrieve issues.
*/ 
function checkMandatoryPreferences()
{
	var prefOK = true;
	
	if (getJiraUsername() == "")
	{
		prefOK = false;
	}
	else if (getJiraPassword() == "")
	{
		prefOK = false;
	}
	else if (getJiraFilterId() == "")
	{
		prefOK = false;
	}
	else if (getJiraUrlLocation() == "")
	{
		prefOK = false;
	}

	if ( !prefOK )
		setInfoMessage("Please set the preferences...");
		
	return prefOK;
}

/**
* Put results into the content area
*/
function buildList(results)
{

	// Generate the display
	addEntriesToContents( results);

	// update the scrollbar so scrollbar matches new data
	scrollArea.refresh();
	
	// set last_updated to the current time to keep track of the last time a request was posted
	last_updated = (new Date).getTime();

}
/**
* Set the filter name
*/
function setFilterName( newfilterId, newfilterName, newfilterURL )
{
	filterName = newfilterName;
	
	setInfoMessage(getFilterNameMessage());
}

/**
* Show the back preference area
*/
function showBack(event)
{
	// your widget needs to show the back

	var front = document.getElementById("front");
	var back = document.getElementById("back");

	if (window.widget)
		widget.prepareForTransition("ToBack");

	front.style.display="none";
	back.style.display="block";
	
	if (window.widget)
		setTimeout('widget.performTransition();', 0);
}

/**
* Show the front area
*/
function showFront(event)
{
	// your widget needs to show the front

	var front = document.getElementById("front");
	var back = document.getElementById("back");

	if (window.widget)
		widget.prepareForTransition("ToFront");

	front.style.display="block";
	back.style.display="none";
	
	if (window.widget)
		setTimeout('widget.performTransition();', 0);

	//save preferences
	savePreferences();
	
	//Update list since preferences may have been changed
	populateIssueList();
	
	scrollArea.refresh();
}

if (window.widget) {
	widget.onremove = remove;
	widget.onhide = hide;
	widget.onshow = show;
}

/**
* Retrieve the contents of an HTML div
*/
function getPropertyFromHTML(propertyKey, defaultValue)
{
	var element = document.getElementById(initKeyPrefix + propertyKey);
	if (element) {
		return trim(element.innerHTML);
	}
	else {
		return defaultValue;
	}
}

/**
* Get the child node of a given name from the specified node
*/
function findChild(element, nodeName)
{
	var child;
	
	for (child = element.firstChild; child != null; child = child.nextSibling) {
		if (child.nodeName == nodeName)
			return child;
	}
	
	return null;
}

/**
* Clear out the content area
*/
function removeEntriesFromContents()
{

	while (contents.hasChildNodes()) {
		contents.removeChild(contents.firstChild);
	}
}

/**
* Add the data to the content area
*/
function addEntriesToContents(entries)
{
	// copy title and date into rows for display. Store link so it can be used when user
	// clicks on title
	var nItems = entries.length;
							
	for (var i = 0; i < nItems; ++i) {
		var item = entries[i];
		var row = createRow (item);
		
		contents.appendChild (row);
	}
	
	numIssues = entries.length;
	
	//Show the number of issues in the filter
	setInfoMessage(getFilterNameMessage());

}

/**
*  Correct hyperlinks in a document fragment to use the openURL function
*/
function fixLinks(htmlFragment)
{
	// Collect all the links
	var links = htmlFragment.getElementsByTagName("a");
	for (var i = 0; i < links.length; i++) {
		var aNode = links[i];
		// Send them to our clickOnLink function
		aNode.onclick = clickOnLink;
	}
}

// XXX - http://delete.me.uk/2005/03/iso8601.html
// XXX - license unclear, discuss or replace
Date.prototype.setISO8601 = function (string) {
    var regexp = "([0-9]{4})(-([0-9]{2})(-([0-9]{2})" +
        "(T([0-9]{2}):([0-9]{2})(:([0-9]{2})(\.([0-9]+))?)?" +
        "(Z|(([-+])([0-9]{2}):([0-9]{2})))?)?)?)?";
    var d = string.match(new RegExp(regexp));

    var offset = 0;
    var date = new Date(d[1], 0, 1);

    if (d[3]) { date.setMonth(d[3] - 1); }
    if (d[5]) { date.setDate(d[5]); }
    if (d[7]) { date.setHours(d[7]); }
    if (d[8]) { date.setMinutes(d[8]); }
    if (d[10]) { date.setSeconds(d[10]); }
    if (d[12]) { date.setMilliseconds(Number("0." + d[12]) * 1000); }
    if (d[14]) {
        offset = (Number(d[16]) * 60) + Number(d[17]);
        offset *= ((d[15] == '-') ? 1 : -1);
    }

    offset -= date.getTimezoneOffset();
    time = (Number(date) + (offset * 60 * 1000));
    this.setTime(Number(time));
}

/**
* This is where the HTML is created for the row to display
*/
function createRow (item)
{
	var article = document.createElement('div');
	article.setAttribute('class', 'article');
	
	var articlehead = document.createElement('a');
	articlehead.setAttribute('class', 'articlehead');

	// add image
	var issuetypediv = document.createElement('img');
	issuetypediv.setAttribute('src', item.issuetype);
	articlehead.appendChild(issuetypediv);
	
	//add a small gap to the title
	var spacer = document.createElement('div');
	spacer.setAttribute('class', 'articlebody');
	spacer.innerHTML = "&nbsp;";
	articlehead.appendChild(spacer);
	
	if (item.link != null) {
		articlehead.setAttribute('the_link', item.link);
		articlehead.setAttribute('onclick', 'clickOnTitle(event, this);');
		articlehead.setAttribute('href', '#');
		articlehead.setAttribute('title', item.description );
	}
	
	var subject_div = document.createElement('div');
	subject_div.setAttribute('class', 'subject');
	subject_div.innerText = item.issuecode + " : " + item.title;
	articlehead.appendChild(subject_div);

	article.appendChild(articlehead);
	
	if (item.description != null) {
		var desc_div = document.createElement('div');
		desc_div.setAttribute('class', 'articlebody');
		desc_div.innerHTML = item.description;

		// Clean up hyperlinks
		fixLinks(desc_div);
		
		article.appendChild(desc_div);
	}
	
	return article;
}

function createDateStr (date)
{
	var month;
	switch (date.getMonth()) {
		case 0: month = 'Jan'; break;
		case 1: month = 'Feb'; break;
		case 2: month = 'Mar'; break;
		case 3: month = 'Apr'; break;
		case 4: month = 'May'; break;
		case 5: month = 'Jun'; break;
		case 6: month = 'Jul'; break;
		case 7: month = 'Aug'; break;
		case 8: month = 'Sep'; break;
		case 9: month = 'Oct'; break;
		case 10: month = 'Nov'; break;
		case 11: month = 'Dec'; break;
	}	
	return month + ' ' + date.getDate();
}

/**
* Display the time the issue list was last updated.
*/
function setInfoMessage(message)
{

  if ( message == null || message == "" )
  {
    infoarea.visible = false;
  }
  else
  {
	infoarea.visible = true;
   setElementText( "infoarea", message);
  }
}

/**
* Scale the description area according to the slider preference
*/
function scaleArticles( value )
{
    content.style.appleLineClamp = value + "%";
}

function endScale()
{
	scaleTo(slider.value);
	scrollArea.refresh();
}

function scaleTo( value ) {
	slider.value = value;
	scaleArticles( value );
}

function scaleToMin() {
	scaleTo( slider.min);
}

function scaleToMax() {
	scaleTo( slider.max );
}

/**
* Set the contents of an HTML div
*/
function setElementText(elementName, elementValue)
{
	var element = document.getElementById(elementName);
	if (element) {
		element.innerText = elementValue;
	}
}

/**
* Open the link in a browser, not the widget
*/
function clickOnTitle(event, div)
{
	if (window.widget) {
		widget.openURL(div.the_link);
	}
}

/**
* Set the filter name and number of issue in info area
*/
function getFilterNameMessage()
{
	if (filterName.length > 0 && numIssues >= 0 )
	{
		if ( filterName.length > 25 )
		{
			return filterName.substring(0,25) + "... (" + numIssues + ")";
		}
		else
		{
			return filterName + " (" + numIssues + ")";
		}
	}
	else
	{
		return ""; 
	}
}
/**
 * Load / get preferences
 **/
function getPreference(prefName, defValue)
{
	if (window.widget)
	{
		var value = widget.preferenceForKey(makeKey(prefName));
		if (value == null)
		{
			return defValue;
		}
		else
		{
			return value;
		}
	}
	else
	{
		return defValue;
	}
}

/**
* A function to make preferences specific to an instance
*/
function makeKey(key)
{
	return (widget.identifier + "-" + key);
}

function getJiraUrlLocation()
{
	return getPreference("jiraUrlLocation", "http://jira.yourcompany.com");
}

function getJiraUsername()
{
	return getPreference("jiraUsername", "");
}

function getJiraPassword()
{
	return getPreference("jiraPassword", "");
}

function getJiraFilterId()
{
	return getPreference("jiraFilterID", "");
}

function getRefreshTime()
{
	return getPreference("refreshTime", "15");
}

function getScale()
{
	return getPreference("scale", slider.max);
}
function loadPreferences()
{
	document.getElementById("jiraurlpref").value = getJiraUrlLocation();
	document.getElementById("jirausernamepref").value = getJiraUsername();
	document.getElementById("jirapaswordpref").value = getJiraPassword();
	document.getElementById("jirafilteridpref").value = getJiraFilterId();
	document.getElementById("jirarefreshpref").value = getRefreshTime();
	slider.value = getScale();
}


/**
 * Set / update preferences
 */
function setPreference(prefName, value)
{
	if (window.widget)
	{
		widget.setPreferenceForKey(value, makeKey(prefName));
	}
}

/**
* Save preferences
*/
function savePreferences()
{
	setPreference("jiraUrlLocation", document.getElementById("jiraurlpref").value );
	setPreference("jiraUsername", document.getElementById("jirausernamepref").value);
	setPreference("jiraPassword", document.getElementById("jirapaswordpref").value);
	setPreference("jiraFilterID", document.getElementById("jirafilteridpref").value);
	setPreference("refreshTime", document.getElementById("jirarefreshpref").value);	
	setPreference("scale", slider.value);
}

/**
 * Remove preferences when widget removed
 */
function removePreferences()
{
	if (window.widget)
	{
		widget.setPreferenceForKey(null, "jiraUrlLocation");
		widget.setPreferenceForKey(null, "jiraUsername");
		widget.setPreferenceForKey(null, "jiraPassword");
		widget.setPreferenceForKey(null, "jiraFilterID");
		widget.setPreferenceForKey(null, "refreshTime");
		widget.setPreferenceForKey(null, "scale");
	}
}
